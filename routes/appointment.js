const express = require('express');
const { bookAppointment, getAppointments, updateAppointmentStatus } = require('../controllers/appointment');
const { getAppointmentStats } = require('../controllers/appointmentStats');
const { auth } = require('../middleware/auth');


const route=express.Router();

route.get('/', /*auth(['admin']),*/ getAppointments);

route.post('/', auth(['user']), bookAppointment);

route.put('/:id/status', auth(['admin']), updateAppointmentStatus);

route.get('/stats'/*, auth(['admin'])*/, getAppointmentStats);

module.exports=route;