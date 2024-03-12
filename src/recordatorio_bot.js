const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
require('dotenv').config();


const publicPath = path.join(__dirname, '../public');


app.get('/', (req, res) => {

  res.sendFile(path.join(publicPath, 'bot_animation.html'));
});


app.listen(port, () => {
  console.log(`Servidor Express corriendo en http://localhost:${port}`);
});




const { Telegraf } = require('telegraf');
const moment = require('moment-timezone');
moment.locale('es');
moment.tz.setDefault('America/Santiago');

const token = process.env.BOT_TOKEN;

const bot = new Telegraf(token);

const reminders = {};

bot.start((ctx) => {
    ctx.reply('¡Hola! Soy tu bot recordatorio. Para programar un recordatorio, envíame un mensaje con el formato:\n\nNombre del recordatorio, Fecha, Hora (HH:mm), Emoji');
});

bot.help((ctx) => {
    ctx.reply('¡Hola! Soy tu bot recordatorio. Para programar un recordatorio, envíame un mensaje con el formato:\n\nNombre del recordatorio, Fecha, Hora (HH:mm), Emoji');
});

bot.command('mostrar', (ctx) => {
    const chatId = ctx.chat.id;
    const userReminders = reminders[chatId] || [];
    if (userReminders.length === 0) {
        ctx.reply('No hay recordatorios programados.');
    } else {
        let reminderList = 'Recordatorios programados:\n';
        userReminders.forEach((reminder, index) => {
            reminderList += `${index + 1}. ${reminder.name} - ${reminder.dateTime.format('LLL')}\n`;
        });
        ctx.reply(reminderList);
    }
});

bot.on('text', (ctx) => {
    const message = ctx.message.text;

    if (message.toLowerCase().includes('hola')) {
        ctx.reply('¡Hola! Para programar un recordatorio, envíame un mensaje con el formato:\n\nNombre del recordatorio, Fecha, Hora (HH:mm), Emoji');
    } else if (message.toLowerCase().startsWith('eliminar')) {
        const nameToDelete = message.split(' ')[1]?.trim();
        if (!nameToDelete) {
            ctx.reply('Por favor, indica el nombre del recordatorio que deseas eliminar.');
            return;
        }
        const removed = removeReminder(ctx.chat.id, nameToDelete);
        if (removed) {
            ctx.reply(`Se ha eliminado el recordatorio "${nameToDelete}" correctamente.`);
        } else {
            ctx.reply(`El recordatorio "${nameToDelete}" no existe.`);
        }
        return;
    } else {
        const details = message.split(',');
        if (details.length !== 4) {
            ctx.reply('El formato del mensaje no es correcto. Por favor, inténtalo de nuevo.');
            return;
        }

        const name = details[0].trim();
        const date = details[1].trim();
        const time = details[2].trim();
        const emoji = details[3].trim();

        if (!moment(date, 'DD/MM/YYYY').isValid()) {
            ctx.reply('La fecha ingresada no es válida. Por favor, inténtalo de nuevo.');
            return;
        }

        if (!moment(time, 'HH:mm').isValid()) {
            ctx.reply('La hora ingresada no es válida. Por favor, inténtalo de nuevo.');
            return;
        }

        const dateTime = parseTime(time, 'HH:mm');
        const reminderMessage = `Recibido recordatorio: ${name} para el ${moment(date, 'DD/MM/YYYY').format('LL')} a las ${dateTime.format('LT')} horas de caracter ${getUrgency(emoji)}`;
        ctx.reply(reminderMessage);

        const added = addReminder(ctx.chat.id, name, dateTime, emoji);
        if (!added) {
            ctx.reply(`El recordatorio "${name}" ya existe. Por favor, elige otro nombre.`);
        }
    }
});

function parseTime(timeString, format) {
    // Convertir hora PM a formato de 24 horas
    let time = moment(timeString, format);
    if (timeString.includes('pm')) {
        time.add(12, 'hours');
    }
    return time;
}

function getUrgency(emoji) {
    if (emoji === '❤️') {
        return 'urgente';
    } else if (emoji === '💛') {
        return 'semi urgente';
    } else if (emoji === '💚') {
        return 'no urgente';
    } else {
        return 'desconocido';
    }
}

function addReminder(chatId, name, dateTime, emoji) {
    reminders[chatId] = reminders[chatId] || [];
    const existingReminderIndex = reminders[chatId].findIndex(reminder => reminder.name.toLowerCase() === name.toLowerCase());
    if (existingReminderIndex !== -1) {
        // Si ya existe un recordatorio con el mismo nombre, mostramos un mensaje y no agregamos uno nuevo
        return false;
    }
    reminders[chatId].push({ name, dateTime, emoji });
    return true;
}

function removeReminder(chatId, name) {
    const userReminders = reminders[chatId] || [];
    const index = userReminders.findIndex(reminder => reminder.name.toLowerCase() === name.toLowerCase());
    if (index !== -1) {
        userReminders.splice(index, 1);
        return true;
    }
    return false;
}

function checkReminders() {
    for (const chatId in reminders) {
        const userReminders = reminders[chatId] || [];
        userReminders.forEach((reminder, index) => {
            if (moment().isSameOrAfter(reminder.dateTime)) {
                const urgency = getUrgency(reminder.emoji);
                const reminderMessage = `${reminder.name} programado para hoy a las ${reminder.dateTime.format('LT')} horas de caracter ${urgency}`;
                bot.telegram.sendMessage(chatId, reminderMessage);
                userReminders.splice(index, 1);
            }
        });
    }
}

setInterval(checkReminders, 60000);

bot.launch().then(() => console.log('Bot corriendo...')).catch(err => console.error(err));
