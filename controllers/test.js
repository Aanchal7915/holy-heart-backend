// services/autoScheduler.js
const mongoose = require('mongoose');
const DoctorSlot = require('../models/DoctorSlot');
const Appointment = require('../models/Appointment');
const ServiceCounter = require('../models/ServiceCounter');
const { DateTime } = require('luxon');

//TODO: check for doctor slot is active or not, doctor is verified or not before adding slots, service is active or not

// CONFIG
const SEARCH_DAYS = 14;
const DEFAULT_DURATION_MIN = 40;
const RESERVATION_TTL_SECONDS = 600;

// Helpers
function toDateOn(dateISO, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return DateTime.fromISO(dateISO).set({ hour: h, minute: m, second: 0, millisecond: 0 }).toJSDate();
}

async function findDoctorsForService(serviceId) {
  return DoctorSlot.find({
    $or: [
      { "services.service": serviceId },
      { "weeklyAvailability.slots.service": serviceId }
    ]
  }).lean();
}

async function pickOrderIndex(serviceId, doctorsLength) {
  if (!doctorsLength || doctorsLength <= 1) return 0;
  const res = await ServiceCounter.findOneAndUpdate(
    { serviceId },
    { $inc: { counter: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  const counter = res.counter || 0;
  return counter % doctorsLength;
}

async function orderDoctors(doctors, serviceId, preferredDoctorId = null) {
  if (!doctors || doctors.length === 0) return [];
  if (preferredDoctorId) {
    const idx = doctors.findIndex(d => String(d._id) === String(preferredDoctorId));
    if (idx >= 0) {
      const pref = doctors.splice(idx, 1)[0];
      return [pref, ...doctors];
    }
  }
  const start = await pickOrderIndex(serviceId, doctors.length);
  return doctors.slice(start).concat(doctors.slice(0, start));
}

async function hasOverlap(doctorId, start, end, session = null) {
  const q = {
    doctor: doctorId,
    status: { $in: ['reserved', 'confirmed'] },
    start: { $lt: end },
    end: { $gt: start }
  };
  if (session) return Appointment.findOne(q).session(session).lean().exec();
  return Appointment.findOne(q).lean().exec();
}

// Reservation / Booking function
async function tryReserveBlock({
  doctorId,
  patientId,
  serviceId,
  slotStart,
  slotEnd,
  charge,
  ttlSeconds = RESERVATION_TTL_SECONDS,
  permanent = false
}) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const overlapping = await hasOverlap(doctorId, slotStart, slotEnd, session);
    if (overlapping) {
      await session.abortTransaction();
      session.endSession();
      return null;
    }

    const reservationExpiresAt = permanent
      ? null
      : DateTime.utc().plus({ seconds: ttlSeconds }).toJSDate();

    const [created] = await Appointment.create([{
      doctor: doctorId,
      patient: patientId,
      service: serviceId,
      start: slotStart,
      end: slotEnd,
      charge,
      status: permanent ? 'confirmed' : 'reserved',
      reservationExpiresAt
    }], { session });

    await session.commitTransaction();
    session.endSession();
    return created;
  } catch (err) {
    await session.abortTransaction().catch(() => { });
    session.endSession();
    return null;
  }
}

// Allocators
async function allocateBlock({ doc, dateISO, serviceId, patientId, charge, permanent }) {
  const slotStart = toDateOn(dateISO, doc.s.start);
  const slotEnd = toDateOn(dateISO, doc.s.end);
  return tryReserveBlock({ doctorId: doc._id, patientId, serviceId, slotStart, slotEnd, charge, permanent });
}

async function allocateSlice({ doc, dateISO, serviceId, patientId, charge, permanent, durationMin }) {
  const slotStart = toDateOn(dateISO, doc.s.start);
  const slotEnd = toDateOn(dateISO, doc.s.end);
  let cursor = slotStart;
  while (cursor < slotEnd) {
    const sliceEnd = DateTime.fromJSDate(cursor).plus({ minutes: durationMin }).toJSDate();
    if (sliceEnd > slotEnd) break;

    const reserved = await tryReserveBlock({
      doctorId: doc._id,
      patientId,
      serviceId,
      slotStart: cursor,
      slotEnd: sliceEnd,
      charge,
      permanent
    });
    if (reserved) return reserved;
    cursor = sliceEnd;
  }
  return null;
}

/**
 * automaticSchedule(options)
 *
 * options:
 *  - serviceId, patientId (required)
 *  - preferredDoctorId (optional)
 *  - preferredDateISO (optional 'YYYY-MM-DD')
 *  - preferredTimeHHMM (optional 'HH:mm')
 *  - searchDays (default 14)
 *  - permanent (default true → reservation without expiry)
 *  - mode ('block' | 'slice', default 'block')
 *  - durationMin (for slice mode, default 30)
 */
async function automaticSchedule({
  serviceId,
  patientId,
  preferredDoctorId = null,
  preferredDateISO = null,
  preferredTimeHHMM = null,
  searchDays = SEARCH_DAYS,
  permanent = true,
  mode = 'block',
  durationMin = DEFAULT_DURATION_MIN
}) {
  console.log({ serviceId, patientId, preferredDoctorId, preferredDateISO, preferredTimeHHMM, searchDays, permanent, mode, durationMin });
  
  const doctorSlotsDocs = await findDoctorsForService(serviceId);
  if (!doctorSlotsDocs || doctorSlotsDocs.length === 0) {
    return { success: false, reason: 'no-doctor-for-service' };
  }

  const doctors = doctorSlotsDocs.map(d => ({
    _id: d.doctor,
    docSlot: d,
    chargeFromServices: (d.services || []).find(s => String(s.service) === String(serviceId))?.chargePerAppointment ?? null
  }));

  const ordered = await orderDoctors(doctors, serviceId, preferredDoctorId);

  const days = preferredDateISO
    ? [preferredDateISO]
    : Array.from({ length: searchDays }, (_, i) => DateTime.local().plus({ days: i }).toISODate());

  for (const dateISO of days) {
    for (const doc of ordered) {
      const dow = DateTime.fromISO(dateISO).toFormat('ccc');
      const slotsForDay = (doc.docSlot.weeklyAvailability || []).find(w => w.day === dow);
      if (!slotsForDay) continue;

      const slotCandidates = (slotsForDay.slots || []).filter(s => String(s.service) === String(serviceId));
      if (!slotCandidates.length) continue;

      if (preferredTimeHHMM) {
        const preferredMoment = toDateOn(dateISO, preferredTimeHHMM);
        for (const s of slotCandidates) {
          const slotStart = toDateOn(dateISO, s.start);
          const slotEnd = toDateOn(dateISO, s.end);
          if (preferredMoment >= slotStart && preferredMoment < slotEnd) {
            const charge = s.chargePerAppointment ?? doc.chargeFromServices ?? 0;
            const reserved = await tryReserveBlock({
              doctorId: doc._id,
              patientId,
              serviceId,
              slotStart,
              slotEnd,
              charge,
              permanent
            });
            if (reserved) return { success: true, appointment: reserved };
          }
        }
      }

      for (const s of slotCandidates) {
        const charge = s.chargePerAppointment ?? doc.chargeFromServices ?? 0;
        if (mode === 'block') {
          const reserved = await tryReserveBlock({
            doctorId: doc._id,
            patientId,
            serviceId,
            slotStart: toDateOn(dateISO, s.start),
            slotEnd: toDateOn(dateISO, s.end),
            charge,
            permanent
          });
          if (reserved) return { success: true, appointment: reserved };
        } else if (mode === 'slice') {
          const reserved = await allocateSlice({ doc: { ...doc, s }, dateISO, serviceId, patientId, charge, permanent, durationMin });
          if (reserved) return { success: true, appointment: reserved };
        }
      }
    }
  }

  return { success: false, reason: 'no-availability-found' };
}

module.exports = { automaticSchedule };
