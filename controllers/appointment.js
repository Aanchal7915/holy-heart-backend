// services/bookingManager.js
const mongoose = require('mongoose');
const DoctorSlot = require('../models/DoctorSlot');
const Appointment = require('../models/Appointment');
const { DateTime } = require('luxon');

exports.bookAppointment = async (req, res) => {
    try {
        let {
            appointmentDate,
            Message,
            serviceType,
        } = req.body;

        // Convert 'DD-MM-YYYY' to 'YYYY-MM-DD'
        if (appointmentDate && typeof appointmentDate === 'string') {
            const [day, month, year] = appointmentDate.split('-');
            appointmentDate = new Date(`${year}-${month}-${day}`);
        }


        const appointment = new Appointment({
            patient: req.user.userId, // Add patientId from authorized user
            appointmentDate,
            Message,
            serviceType
        });

        await appointment.save();
        res.status(201).json({ message: 'Appointment booked successfully', appointment });
    } catch (error) {
        console.error('AppointmentController - bookAppointment:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

exports.getAppointments = async (req, res) => {
    try {
        // Filtering
        const { startDate, endDate, status, serviceType, sort = 'desc', page = 1, limit = 1 } = req.query;
        const filter = {};
        // Date range filtering
        if (startDate || endDate) {
            filter.appointmentDate = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0,0,0,0);
                filter.appointmentDate.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23,59,59,999);
                filter.appointmentDate.$lte = end;
            }
        }
        if (status) filter.status = status;
        if (serviceType) filter.serviceType = serviceType;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Sorting
        const sortOrder = sort === 'asc' ? 1 : -1;
        const appointmentsRaw = await Appointment.find(filter)
            .sort({ appointmentDate: sortOrder })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('patient', 'name email phoneNu').populate('doctor', 'name email phoneNu').populate('service', 'name description');

        const appointments = appointmentsRaw.map(app => {
            const obj = app.toObject();
            const patientDetail = obj.patient;
            delete obj.patient;
            
            return {...obj, 
                patientName: patientDetail.name, 
                patientEmail: patientDetail.email, 
                patientPhone: patientDetail.phoneNu,
                userId: patientDetail._id 
            };
        });

        // Total count for pagination
        const total = await Appointment.countDocuments(filter);

        res.status(200).json({
            appointments,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('AppointmentController - getAppointments:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

exports.updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        // Validate status
        const validStatuses = ['Pending', 'Confirmed', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }
        const appointment = await Appointment.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        res.status(200).json({ message: 'Appointment status updated', appointment });
    } catch (error) {
        console.error('AppointmentController - updateAppointmentStatus:', error);
        res.status(500).json({ message: 'Server error' });
    }
};



// CONFIG
const SEARCH_DAYS = 14;
const SLIDE_STEP_MIN = 15; // minutes
const DEFAULT_DURATION_MIN = 30;
const RESERVATION_TTL_SECONDS = 600;

// helpers
function toDateOn(dateISO, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return DateTime.fromISO(dateISO).set({ hour: h, minute: m, second: 0, millisecond: 0 }).toJSDate();
}
function* candidateStartsForSlot(slotStartStr, slotEndStr, dateISO, durationMin, stepMin = SLIDE_STEP_MIN) {
  const slotStart = DateTime.fromJSDate(toDateOn(dateISO, slotStartStr));
  const slotEnd = DateTime.fromJSDate(toDateOn(dateISO, slotEndStr));
  if (slotEnd.diff(slotStart, 'minutes').minutes < durationMin) return;
  for (let cur = slotStart; cur.plus({ minutes: durationMin }) <= slotEnd; cur = cur.plus({ minutes: stepMin })) {
    yield { start: cur.toJSDate(), end: cur.plus({ minutes: durationMin }).toJSDate() };
  }
}

function candidateFullSlot(s, dateISO) {
  const start = DateTime.fromISO(`${dateISO}T${s.start}`);
  const end = DateTime.fromISO(`${dateISO}T${s.end}`);
  return [{ start, end }];
}


// in-memory round robin tracker (works per instance)
const rrCounters = new Map();
async function orderDoctors(doctors, preferredDoctorId) {
  console.log("orderDoctors input:", { preferredDoctorId });
  if (!doctors || doctors.length === 0) return [];
  if (preferredDoctorId) {
    const idx = doctors.findIndex(d => String(d._id) === String(preferredDoctorId));
    if (idx >= 0) {
      const pref = doctors.splice(idx, 1)[0];
      return [pref, ...doctors];
    }
  }
  const key = `rr:service:${doctors[0].serviceId || 'svc'}`;
  const counter = (rrCounters.get(key) || 0) + 1;
  rrCounters.set(key, counter);
  const start = counter % doctors.length;
  return doctors.slice(start).concat(doctors.slice(0, start));
}

// find doctors who list this service
async function findDoctorsForService(serviceId) {
  return DoctorSlot.find({
    $or: [
      { "services.service": serviceId },
      { "weeklyAvailability.slots.service": serviceId }
    ]
  }).lean();
}

// try reserving a slot
async function tryReserve(doctorId, patientId, serviceId, start, end, charge, ttlSeconds = RESERVATION_TTL_SECONDS) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const overlapping = await Appointment.findOne({
      doctor: doctorId,
      status: { $in: ['reserved', 'confirmed'] },
      start: { $lt: end },
      end: { $gt: start }
    }).session(session);
    if (overlapping) {
      await session.abortTransaction();
      session.endSession();
      return null;
    }

    const reservationExpiresAt = DateTime.utc().plus({ seconds: ttlSeconds }).toJSDate();
    const appt = await Appointment.create([{
      doctor: doctorId,
      patient: patientId,
      service: serviceId,
      start, end,
      charge,
      status: 'reserved',
      reservationExpiresAt
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return appt[0];
  } catch (e) {
    await session.abortTransaction().catch(() => { });
    session.endSession();
    return null;
  }
}

// main booking function
 exports.automaticBookAcrossDoctors=async function({
  serviceId,
  patientId,
  preferredDoctorId = null,
  preferredDateISO = null,
  preferredTimeHHMM = null,
  durationMinutes = DEFAULT_DURATION_MIN,
  reservationTTLSeconds = RESERVATION_TTL_SECONDS,
  searchDays = SEARCH_DAYS
}) {
  const doctorSlotsDocs = await findDoctorsForService(serviceId);
  console.log("doctorSlotDocs for the requested service: ", doctorSlotsDocs)
  if (!doctorSlotsDocs || doctorSlotsDocs.length === 0) return { success: false, reason: 'no-doctor-for-service' };

  const doctors = doctorSlotsDocs.map(d => ({
    _id: d.doctor,
    docSlot: d,
    serviceId,
    chargeFromServices: (d.services || []).find(s => String(s.service) === String(serviceId))?.chargePerAppointment || null
  }));

  console.log("Doctors offering the service: ", doctors);

  const ordered = await orderDoctors(doctors, preferredDoctorId);
  const days = preferredDateISO ? [preferredDateISO] :
    Array.from({ length: searchDays }, (_, i) => DateTime.local().plus({ days: i }).toISODate());
  console.log("Ordered doctors: ", ordered);
  console.log("Search days: ", days);
  for (const dateISO of days) {
    const timesToFavor = preferredTimeHHMM ? [preferredTimeHHMM] : null;
    console.log("Times to favor: ", timesToFavor);
    for (const doc of ordered) {
      const slotsForDay = (doc.docSlot.weeklyAvailability || [])
        .find(w => w.day === DateTime.fromISO(dateISO).toFormat('ccc'));
      console.log(`Checking doctor ${doc._id} on ${dateISO}, slots: `, slotsForDay);
      if (!slotsForDay) continue;

      const slotCandidates = (slotsForDay.slots || []).filter(s => String(s.service) === String(serviceId));
      console.log(`Slot candidates for doctor ${doc._id} on ${dateISO}: `, slotCandidates);
      const chargeDefault = doc.chargeFromServices ?? (slotCandidates[0]?.chargePerAppointment ?? 0);
      console.log(`Using charge per appointment: ${chargeDefault}`);

      // Step A: try preferred time first
      if (timesToFavor) {
        for (const t of timesToFavor) {
          for (const s of slotCandidates) {
            const slotStart = toDateOn(dateISO, s.start);
            const slotEnd = toDateOn(dateISO, s.end);
            const desiredStart = toDateOn(dateISO, t);
            const desiredEnd = DateTime.fromJSDate(desiredStart).plus({ minutes: durationMinutes }).toJSDate();
            if (desiredStart >= slotStart && desiredEnd <= slotEnd) {
              const reserved = await tryReserve(
                doc._id, patientId, serviceId, desiredStart, desiredEnd,
                s.chargePerAppointment ?? chargeDefault,
                reservationTTLSeconds
              );
              if (reserved) return { success: true, appointment: reserved };
            }
          }
        }
      }

      // Step B: sliding candidates
      for (const s of slotCandidates) {
        for (const cand of candidateStartsForSlot(s.start, s.end, dateISO, durationMinutes)) {
          const reserved = await tryReserve(
            doc._id, patientId, serviceId, cand.start, cand.end,
            s.chargePerAppointment ?? chargeDefault,
            reservationTTLSeconds
          );
          if (reserved) return { success: true, appointment: reserved };
        }
      }
    }
  }

  return { success: false, reason: 'no-availability-found' };
}


































// // services/bookingManager.js
// const mongoose = require('mongoose');
// const DoctorSlot = require('../models/DoctorSlot');
// const Appointment = require('../models/Appointment');
// const IORedis = require('ioredis');
// const Redlock = require('redlock');
// const { DateTime } = require('luxon');

// const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
// const redlock = new Redlock([redis], { driftFactor: 0.01, retryCount: 3, retryDelay: 150 });

// // CONFIG
// const SEARCH_DAYS = 14;
// const SLIDE_STEP_MIN = 15; // minutes
// const DEFAULT_DURATION_MIN = 30;
// const RESERVATION_TTL_SECONDS = 600;

// // helpers
// const dowMap = { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun' };
// function toDateOn(dateISO, hhmm) { const [h,m]=hhmm.split(':').map(Number); return DateTime.fromISO(dateISO).set({hour:h,minute:m,second:0,millisecond:0}).toJSDate(); }
// const overlaps = (a,b,c,d)=> a<d && c<b;

// // pick order: preferred -> round-robin across doctors (use Redis counter)
// async function orderDoctors(doctors, preferredDoctorId) {
//   if (!doctors || doctors.length===0) return [];
//   // prefer explicit doctor
//   if (preferredDoctorId) {
//     const idx = doctors.findIndex(d=>String(d._id)===String(preferredDoctorId));
//     if (idx>=0) {
//       const pref = doctors.splice(idx,1)[0];
//       return [pref, ...doctors];
//     }
//   }
//   // round robin using Redis counter
//   const key = `rr:service:${doctors[0].serviceId || 'svc'}`; // service-specific key
//   const counter = await redis.incr(key);
//   const start = counter % doctors.length;
//   return doctors.slice(start).concat(doctors.slice(0,start));
// }

// // find doctors who list this service (and return DoctorSlot docs)
// async function findDoctorsForService(serviceId) {
//   // doctorSlots where either services array contains serviceId OR slot-level service matches
//   return DoctorSlot.find({
//     $or: [
//       { "services.service": serviceId },
//       { "weeklyAvailability.slots.service": serviceId }
//     ]
//   }).lean();
// }

// // generate candidate start datetimes for a slot on dateISO
// function* candidateStartsForSlot(slotStartStr, slotEndStr, dateISO, durationMin, stepMin=SLIDE_STEP_MIN){
//   const slotStart = DateTime.fromJSDate(toDateOn(dateISO, slotStartStr));
//   const slotEnd = DateTime.fromJSDate(toDateOn(dateISO, slotEndStr));
//   if (slotEnd.diff(slotStart,'minutes').minutes < durationMin) return;
//   for (let cur = slotStart; cur.plus({minutes: durationMin}) <= slotEnd; cur = cur.plus({minutes: stepMin})){
//     yield { start: cur.toJSDate(), end: cur.plus({minutes: durationMin}).toJSDate() };
//   }
// }

// // check DB for overlapping confirmed/reserved appointments
// async function hasOverlap(doctorId, candidateStart, candidateEnd, session=null){
//   const q = {
//     doctor: doctorId,
//     status: { $in: ['reserved','confirmed'] },
//     start: { $lt: candidateEnd },
//     end: { $gt: candidateStart }
//   };
//   if (session) return Appointment.findOne(q).session(session).lean().exec();
//   return Appointment.findOne(q).lean().exec();
// }

// // core: try reserve a single candidate with transaction
// async function tryReserve(doctorId, patientId, serviceId, start, end, charge, ttlSeconds=RESERVATION_TTL_SECONDS){
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const overlapping = await hasOverlap(doctorId, start, end, session);
//     if (overlapping) { await session.abortTransaction(); session.endSession(); return null; }
//     const reservationExpiresAt = DateTime.utc().plus({ seconds: ttlSeconds }).toJSDate();
//     const appt = await Appointment.create([{
//       doctor: doctorId, patient: patientId, service: serviceId,
//       start, end, charge, status: 'reserved', reservationExpiresAt
//     }], { session });
//     await session.commitTransaction();
//     session.endSession();
//     return appt[0];
//   } catch(e){
//     await session.abortTransaction().catch(()=>{});
//     session.endSession();
//     return null;
//   }
// }

// // public API: find next nearest slot across doctors for a service & reserve it
// async function automaticBookAcrossDoctors({
//   serviceId, patientId,
//   preferredDoctorId=null,
//   preferredDateISO=null, // optional ISO date 'YYYY-MM-DD' or null
//   preferredTimeHHMM=null, // optional 'HH:mm' — try exact near time
//   durationMinutes=DEFAULT_DURATION_MIN,
//   reservationTTLSeconds=RESERVATION_TTL_SECONDS,
//   searchDays=SEARCH_DAYS
// }){
//   // 1) load candidates (doctors offering service)
//   const doctorSlotsDocs = await findDoctorsForService(serviceId);
//   if (!doctorSlotsDocs || doctorSlotsDocs.length===0) return { success:false, reason:'no-doctor-for-service' };

//   // normalize docs with id + charge + weeklyAvailability
//   const doctors = doctorSlotsDocs.map(d=>{
//     return { _id:d.doctor, docSlot:d, serviceId, chargeFromServices: (d.services||[]).find(s=>String(s.service)===String(serviceId))?.chargePerAppointment || null };
//   });

//   // 2) order doctors (preferred or RR)
//   const ordered = await orderDoctors(doctors, preferredDoctorId);

//   // 3) search dates
//   const days = preferredDateISO ? [preferredDateISO] :
//     Array.from({length: searchDays}, (_,i)=> DateTime.local().plus({days:i}).toISODate());

//   // main loop: try doctors in order, find earliest candidate on earliest date
//   for (const dateISO of days){
//     // if user provided preferred time, give those candidates priority
//     const timesToFavor = preferredTimeHHMM ? [preferredTimeHHMM] : null;

//     for (const doc of ordered){
//       const lockKey = `lock:doctor:${doc._id}:${dateISO}`;
//       let lock = null;
//       try {
//         lock = await redlock.acquire([lockKey], 3000);
//       } catch(e){
//         // could not lock; skip this doctor for this date
//         continue;
//       }

//       try {
//         const slotsForDay = (doc.docSlot.weeklyAvailability || []).find(w=> w.day === DateTime.fromISO(dateISO).toFormat('ccc'));
//         if (!slotsForDay) { await lock.release().catch(()=>{}); continue; }

//         // collect slots that match service either at slot.service or in services array
//         const slotCandidates = (slotsForDay.slots || []).filter(s=> String(s.service)===String(serviceId));

//         // if services array defines a charge, prefer it
//         const chargeDefault = doc.chargeFromServices ?? (slotCandidates[0]?.chargePerAppointment ?? 0);

//         // Step A: if preferred time is provided, try near-exact match first
//         if (timesToFavor){
//           for (const t of timesToFavor){
//             // create candidate that starts at t if within any slot
//             for (const s of slotCandidates){
//               const slotStart = toDateOn(dateISO, s.start);
//               const slotEnd = toDateOn(dateISO, s.end);
//               const desiredStart = toDateOn(dateISO, t);
//               const desiredEnd = DateTime.fromJSDate(desiredStart).plus({minutes: durationMinutes }).toJSDate();
//               if (desiredStart >= slotStart && desiredEnd <= slotEnd){
//                 const reserved = await tryReserve(doc._id, patientId, serviceId, desiredStart, desiredEnd, s.chargePerAppointment ?? chargeDefault, reservationTTLSeconds);
//                 if (reserved) { await lock.release().catch(()=>{}); return { success:true, appointment:reserved }; }
//               }
//             }
//           }
//         }

//         // Step B: slide through slot(s) to find next available
//         for (const s of slotCandidates){
//           for (const cand of candidateStartsForSlot(s.start, s.end, dateISO, durationMinutes)){
//             const reserved = await tryReserve(doc._id, patientId, serviceId, cand.start, cand.end, s.chargePerAppointment ?? chargeDefault, reservationTTLSeconds);
//             if (reserved){ await lock.release().catch(()=>{}); return { success:true, appointment:reserved }; }
//           }
//         }

//       } finally {
//         await lock.release().catch(()=>{});
//       }
//     } // end doctors loop
//   } // end date loop

//   return { success:false, reason:'no-availability-found' };
// }

// module.exports = { automaticBookAcrossDoctors };

