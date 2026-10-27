// Event model: an event (talk, meeting, workshop) that attendees give
// feedback on. Not an event-emitter thing.
//
// The document shape { event: {...}, feedback: [...] } and the
// 'jimoo_events' collection are unchanged from v1, so existing data loads.

const mongoose = require('mongoose')

const PIN_PATTERN = /^[A-Z0-9]{5}$/
const RATINGS = ['event', 'presenter', 'engaging', 'innovative', 'inspiring', 'informative']

const rating = { type: Number, required: true, min: 1, max: 5, validate: { validator: Number.isInteger, message: '{PATH} must be a whole number' } }

const feedbackSchema = new mongoose.Schema({
    rating: Object.fromEntries(RATINGS.map(r => [r, rating])),
    notes: { type: String, trim: true, maxlength: 2000 },
    name: { type: String, trim: true, maxlength: 100 },
    email: { type: String, trim: true, maxlength: 200 },
    date: { type: Date, default: Date.now }
}, { _id: false })

const text = (maxlength, required = true) => ({ type: String, trim: true, required, maxlength })

const eventSchema = new mongoose.Schema({
    event: {
        name: text(200),
        location: text(200),
        presenter: text(200),
        email: { ...text(200), match: [/^[^\s@]+@[^\s@]+$/, 'email must look like name@example.com'] },
        start: { type: Date, required: true },
        end: {
            type: Date,
            required: true,
            validate: {
                // document saves only; updates are checked in lib/events.js
                validator(end) {
                    if (!(this instanceof mongoose.Document)) return true
                    const start = this.event && this.event.start
                    return !start || !end || end >= start
                },
                message: 'end must not be before start'
            }
        },
        notes: text(2000, false),
        pin: { type: String, required: true, match: PIN_PATTERN },
        deleted: { type: Boolean, default: false },
        deletedAt: Date
    },
    feedback: { type: [feedbackSchema], default: [] }
}, {
    collection: 'jimoo_events',
    versionKey: false
})

// PINs are unique among live events; soft-deleted events keep theirs
eventSchema.index({ 'event.pin': 1 }, { unique: true, partialFilterExpression: { 'event.deleted': false } })
eventSchema.index({ 'event.start': 1, _id: 1 })

module.exports = mongoose.models.JimooEvent || mongoose.model('JimooEvent', eventSchema)
module.exports.RATINGS = RATINGS
module.exports.PIN_PATTERN = PIN_PATTERN
