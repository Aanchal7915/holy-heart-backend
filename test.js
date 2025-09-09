// // services/autoScheduler.js
// const mongoose = require('mongoose');
// const DoctorSlot = require('../models/DoctorSlot');
// const Appointment = require('../models/Appointment');
// const ServiceCounter = require('../models/ServiceCounter');
// const { DateTime } = require('luxon');

// // CONFIG
// const SEARCH_DAYS = 14;
// const DEFAULT_DURATION_MIN = 30;            // not used for block mode but kept for compat
// const RESERVATION_TTL_SECONDS = 600;        // reservation hold TTL (seconds)

// // Helpers
// function toDateOn(dateISO, hhmm) {
//   const [h, m] = hhmm.split(':').map(Number);
//   return DateTime.fromISO(dateISO).set({ hour: h, minute: m, second: 0, millisecond: 0 }).toJSDate();
// }

// async function findDoctorsForService(serviceId) {
//   // finds DoctorSlot docs where the doctor declares the service OR a slot uses the service
//   return DoctorSlot.find({
//     $or: [
//       { "services.service": serviceId },
//       { "weeklyAvailability.slots.service": serviceId }
//     ]
//   }).lean();
// }

// // distributed round-robin using Mongo upsert+inc (works across instances)
// async function pickOrderIndex(serviceId, doctorsLength) {
//   if (!doctorsLength || doctorsLength <= 1) return 0;
//   const res = await ServiceCounter.findOneAndUpdate(
//     { serviceId },
//     { $inc: { counter: 1 } },
//     { upsert: true, new: true, setDefaultsOnInsert: true }
//   ).lean();
//   const counter = res.counter || 0;
//   return counter % doctorsLength;
// }

// // Given doctors array and optional preferredDoctorId, return ordered array starting from rr index
// async function orderDoctors(doctors, serviceId, preferredDoctorId = null) {
//   if (!doctors || doctors.length === 0) return [];
//   if (preferredDoctorId) {
//     const idx = doctors.findIndex(d => String(d._id) === String(preferredDoctorId));
//     if (idx >= 0) {
//       const pref = doctors.splice(idx, 1)[0];
//       return [pref, ...doctors];
//     }
//   }
//   const start = await pickOrderIndex(serviceId, doctors.length);
//   return doctors.slice(start).concat(doctors.slice(0, start));
// }

// // Check for any overlapping active appointment for doctor (reserved/confirmed)
// async function hasOverlap(doctorId, start, end, session = null) {
//   const q = {
//     doctor: doctorId,
//     status: { $in: ['reserved', 'confirmed'] },
//     start: { $lt: end },
//     end: { $gt: start }
//   };
//   if (session) return Appointment.findOne(q).session(session).lean().exec();
//   return Appointment.findOne(q).lean().exec();
// }

// // Try to reserve a full slot (block) using a Mongo transaction
// async function tryReserveBlock({ doctorId, patientId, serviceId, slotStart, slotEnd, charge, ttlSeconds = RESERVATION_TTL_SECONDS }) {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     // check overlap inside the transaction
//     const overlapping = await hasOverlap(doctorId, slotStart, slotEnd, session);
//     if (overlapping) {
//       await session.abortTransaction();
//       session.endSession();
//       return null;
//     }

//     const reservationExpiresAt = DateTime.utc().plus({ seconds: ttlSeconds }).toJSDate();

//     const [created] = await Appointment.create([{
//       doctor: doctorId,
//       patient: patientId,
//       service: serviceId,
//       start: slotStart,
//       end: slotEnd,
//       charge,
//       status: 'reserved',
//       reservationExpiresAt
//     }], { session });

//     await session.commitTransaction();
//     session.endSession();
//     return created;
//   } catch (err) {
//     await session.abortTransaction().catch(()=>{});
//     session.endSession();
//     return null;
//   }
// }

// /**
//  * automaticSchedule(options)
//  *
//  * options:
//  *  - serviceId (ObjectId|string) required
//  *  - patientId (ObjectId|string) required
//  *  - preferredDoctorId (optional)
//  *  - preferredDateISO (optional) 'YYYY-MM-DD'
//  *  - preferredTimeHHMM (optional) 'HH:mm' (if present, will match a slot that contains this time)
//  *  - searchDays (optional) default SEARCH_DAYS
//  *
//  * Behavior:
//  *  - Block allocation: each doctor's declared slot (start..end) is the unit of reservation.
//  *  - If preferredTime is provided, a slot that contains that time is tried first.
//  *  - Round-robin load balancing across doctors offering the service (Mongo-backed).
//  */
// async function automaticSchedule({
//   serviceId,
//   patientId,
//   preferredDoctorId = null,
//   preferredDateISO = null,
//   preferredTimeHHMM = null,
//   searchDays = SEARCH_DAYS
// }) {
//   // 1) load doctors offering service
//   const doctorSlotsDocs = await findDoctorsForService(serviceId);
//   if (!doctorSlotsDocs || doctorSlotsDocs.length === 0) {
//     return { success: false, reason: 'no-doctor-for-service' };
//   }

//   // normalize doctors array
//   const doctors = doctorSlotsDocs.map(d => ({
//     _id: d.doctor,
//     docSlot: d,
//     chargeFromServices: (d.services || []).find(s => String(s.service) === String(serviceId))?.chargePerAppointment ?? null
//   }));

//   // 2) order doctors (RR or preferred first)
//   const ordered = await orderDoctors(doctors, serviceId, preferredDoctorId);

//   // 3) build date window
//   const days = preferredDateISO ? [preferredDateISO] :
//     Array.from({ length: searchDays }, (_, i) => DateTime.local().plus({ days: i }).toISODate());

//   // 4) loop days -> doctors -> slots (block)
//   for (const dateISO of days) {
//     for (const doc of ordered) {
//       const dow = DateTime.fromISO(dateISO).toFormat('ccc'); // Mon, Tue, ...
//       const slotsForDay = (doc.docSlot.weeklyAvailability || []).find(w => w.day === dow);
//       if (!slotsForDay) continue;

//       // filter slots that apply to this service
//       const slotCandidates = (slotsForDay.slots || []).filter(s => String(s.service) === String(serviceId));
//       if (!slotCandidates.length) continue;

//       // try preferredTime inside slots first (if provided)
//       if (preferredTimeHHMM) {
//         const preferredMoment = toDateOn(dateISO, preferredTimeHHMM);
//         for (const s of slotCandidates) {
//           const slotStart = toDateOn(dateISO, s.start);
//           const slotEnd = toDateOn(dateISO, s.end);
//           // if preferred time sits inside the block -> reserve the full block
//           if (preferredMoment >= slotStart && preferredMoment < slotEnd) {
//             const charge = s.chargePerAppointment ?? doc.chargeFromServices ?? 0;
//             const reserved = await tryReserveBlock({
//               doctorId: doc._id,
//               patientId,
//               serviceId,
//               slotStart,
//               slotEnd,
//               charge
//             });
//             if (reserved) return { success: true, appointment: reserved };
//           }
//         }
//       }

//       // otherwise, try each full slot (first-fit)
//       for (const s of slotCandidates) {
//         const slotStart = toDateOn(dateISO, s.start);
//         const slotEnd = toDateOn(dateISO, s.end);
//         const charge = s.chargePerAppointment ?? doc.chargeFromServices ?? 0;
//         const reserved = await tryReserveBlock({
//           doctorId: doc._id,
//           patientId,
//           serviceId,
//           slotStart,
//           slotEnd,
//           charge
//         });
//         if (reserved) return { success: true, appointment: reserved };
//       }
//     } // doctors
//   } // days

//   return { success: false, reason: 'no-availability-found' };
// }

// module.exports = { automaticSchedule };


// Helper functions
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function addDays(date, days) {
  const nd = new Date(date);
  nd.setDate(nd.getDate() + days);
  return nd;
}
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


dat= "2025-09-14T22:14:14.375Z"
slotStart="2025-09-14T03:30:00.000+00:00"
slotEnd ="2025-09-15T04:00:00.000Z"
console.log(new Date(slotStart).toLocaleString("en-GB"))
function withCustomTime(date, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date); // copy the date
  d.setHours(h, m, 0, 0);   // set custom hours & minutes
  return d.toLocaleString("en-GB", { hour12: false });
}

// Example
const dt = new Date();
console.log(withCustomTime(dt, "09:00")); // "09/09/2025, 09:00:00"
console.log(withCustomTime(dt, "09:30")); // "09/09/2025, 15:45:00"
