// Data access for events and their feedback. The app only talks to MongoDB
// through this object, so tests can inject a fake.

const crypto = require('node:crypto')
const mongoose = require('mongoose')
const DefaultEvent = require('../models/eventModel')
const { RATINGS, PIN_PATTERN } = DefaultEvent
const { NotFoundError, BadRequestError } = require('./errors')
const { parseLocal, rangeBounds, defaultRange } = require('./dates')

const PIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0, 1
const PIN_LENGTH = 5
const PIN_ATTEMPTS = 20
const MAX_PAGE = 100
const TEXT_FIELDS = ['name', 'location', 'presenter', 'email', 'notes']
const LIVE = { 'event.deleted': false }

function makePin(randomInt = crypto.randomInt) {
    let pin = ''
    for (let i = 0; i < PIN_LENGTH; i++) pin += PIN_ALPHABET[randomInt(PIN_ALPHABET.length)]
    return pin
}

function normalisePin(pin) {
    const p = typeof pin === 'string' ? pin.trim().toUpperCase() : ''
    if (!PIN_PATTERN.test(p)) throw new BadRequestError('PIN must be 5 letters or digits')
    return p
}

function checkId(id) {
    if (typeof id !== 'string' || !mongoose.isObjectIdOrHexString(id)) {
        throw new BadRequestError(`'${String(id).slice(0, 64)}' is not a valid event id`)
    }
    return id
}

const str = v => (v === undefined || v === null ? undefined : String(v))

// Event form -> { name, ..., start, end }. Only known fields, always as
// strings, so request bodies can't smuggle operators into a query.
function pickEvent(body = {}) {
    const out = {}
    for (const f of TEXT_FIELDS) out[f] = str(body[f])
    out.start = parseLocal(body.startdate, body.starttime, 'start')
    out.end = parseLocal(body.enddate, body.endtime, 'end')
    if (out.end < out.start) throw new BadRequestError('end must not be before start')
    return out
}

// Feedback form -> feedback entry. Every rating must be a whole number 1-5.
function pickFeedback(body = {}) {
    const rating = {}
    const bad = []
    for (const r of RATINGS) {
        const n = Number(body[r])
        if (typeof body[r] !== 'string' || !Number.isInteger(n) || n < 1 || n > 5) bad.push(r)
        else rating[r] = n
    }
    if (bad.length) throw new BadRequestError(`rate each of: ${bad.join(', ')} (1 to 5)`)
    const optional = v => (typeof v === 'string' && v.trim() ? v : undefined)
    return { rating, notes: optional(body.notes), name: optional(body.name), email: optional(body.email), date: new Date() }
}

function plain(doc) {
    if (!doc) return doc
    const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc }
    delete o.__v // v1 documents still carry it
    return o
}

// Per-rating averages, rounded to 1dp
function summarise(feedback = []) {
    const averages = {}
    for (const r of RATINGS) {
        const values = feedback.map(f => f.rating && f.rating[r]).filter(Number.isFinite)
        averages[r] = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null
    }
    return { count: feedback.length, averages }
}

// Cursor for keyset pagination on (event.start, _id)
function encodeCursor(row) {
    return `${new Date(row.event.start).getTime()}_${row._id}`
}
function decodeCursor(cursor) {
    const m = /^(-?\d{1,15})_([0-9a-f]{24})$/i.exec(cursor)
    if (!m) throw new BadRequestError('invalid page cursor')
    return { start: new Date(Number(m[1])), id: new mongoose.Types.ObjectId(m[2]) }
}

function createEventsRepo(Event = DefaultEvent, { randomInt = crypto.randomInt } = {}) {
    // Insert with a fresh PIN, retrying on a collision. The partial unique
    // index makes this race-free; the exists() check avoids most retries.
    async function insertWithPin(doc) {
        for (let attempt = 0; attempt < PIN_ATTEMPTS; attempt++) {
            const pin = makePin(randomInt)
            if (await Event.exists({ 'event.pin': pin, ...LIVE })) continue
            try {
                return plain(await Event.create({ ...doc, event: { ...doc.event, pin, deleted: false } }))
            } catch (err) {
                if (err.code === 11000 && err.keyPattern && err.keyPattern['event.pin']) continue
                throw err
            }
        }
        throw new Error(`could not generate a unique PIN after ${PIN_ATTEMPTS} attempts`)
    }

    async function getLive(id) {
        const doc = await Event.findOne({ _id: checkId(id), ...LIVE }).lean()
        if (!doc) throw new NotFoundError(`event ${id} not found`)
        return plain(doc)
    }

    return {
        async list({ from, to, after, limit = 20 } = {}) {
            const range = { ...defaultRange(), ...(from ? { from } : {}), ...(to ? { to } : {}) }
            const { start, end } = rangeBounds(range.from, range.to)
            const size = Math.min(Math.max(parseInt(limit, 10) || 20, 1), MAX_PAGE)
            const match = { ...LIVE, 'event.start': { $gte: start, $lt: end } }
            const page = { ...match }
            if (after) {
                const c = decodeCursor(after)
                page.$or = [{ 'event.start': { $gt: c.start, $lt: end } }, { 'event.start': c.start, _id: { $gt: c.id } }]
                delete page['event.start']
            }
            // aggregate: pipelines aren't touched by sanitizeFilter, and every
            // value here is a Date/ObjectId we built ourselves
            const rows = await Event.aggregate([
                { $match: page },
                { $sort: { 'event.start': 1, _id: 1 } },
                { $limit: size + 1 },
                {
                    $project: {
                        event: 1,
                        feedbackCount: { $size: { $ifNull: ['$feedback', []] } },
                        averageRating: { $avg: '$feedback.rating.event' }
                    }
                }
            ])
            const items = rows.slice(0, size).map(r => ({
                ...r,
                averageRating: r.averageRating == null ? null : Math.round(r.averageRating * 10) / 10
            }))
            // trusted(): sanitizeFilter is on, and this range is ours, built from validated dates
            const total = await Event.countDocuments({ ...LIVE, 'event.start': mongoose.trusted({ $gte: start, $lt: end }) })
            return {
                items,
                total,
                limit: size,
                from: range.from,
                to: range.to,
                next: rows.length > size ? encodeCursor(items[items.length - 1]) : null
            }
        },

        async get(id) {
            const doc = await getLive(id)
            return { ...doc, summary: summarise(doc.feedback) }
        },

        // What an attendee sees after entering a PIN: no contact email,
        // notes or other people's feedback
        async findByPin(pin) {
            const p = normalisePin(pin)
            const doc = await Event.findOne({ 'event.pin': p, ...LIVE }, {
                'event.name': 1, 'event.presenter': 1, 'event.location': 1, 'event.start': 1, 'event.end': 1, 'event.pin': 1
            }).lean()
            if (!doc) throw new NotFoundError(`no event with PIN ${p}`)
            return { pin: doc.event.pin, name: doc.event.name, presenter: doc.event.presenter, location: doc.event.location, start: doc.event.start, end: doc.event.end }
        },

        async create(body) {
            return insertWithPin({ event: pickEvent(body), feedback: [] })
        },

        // Only the event details change: PIN and feedback are left alone
        async update(id, body) {
            const fields = pickEvent(body)
            const before = await getLive(id)
            const $set = Object.fromEntries(Object.entries(fields).map(([k, v]) => [`event.${k}`, v]))
            const after = await Event.findOneAndUpdate({ _id: id, ...LIVE }, { $set }, {
                returnDocument: 'after',
                runValidators: true
            }).lean()
            if (!after) throw new NotFoundError(`event ${id} not found`)
            return { before, after: plain(after) }
        },

        // Soft delete, as in v1: the document and its feedback are kept
        async remove(id) {
            const doc = await Event.findOneAndUpdate({ _id: checkId(id), ...LIVE }, {
                $set: { 'event.deleted': true, 'event.deletedAt': new Date() }
            }, { returnDocument: 'after', projection: { feedback: 0 } }).lean()
            if (!doc) throw new NotFoundError(`event ${id} not found`)
            return plain(doc)
        },

        async addFeedback(pin, body) {
            const p = normalisePin(pin)
            const entry = pickFeedback(body)
            const doc = await Event.findOneAndUpdate({ 'event.pin': p, ...LIVE }, { $push: { feedback: entry } }, {
                returnDocument: 'after',
                runValidators: true,
                projection: { 'event.name': 1, 'event.pin': 1 }
            }).lean()
            if (!doc) throw new NotFoundError(`no event with PIN ${p}`)
            return { event: { pin: doc.event.pin, name: doc.event.name }, feedback: entry }
        },

        async seed(now = new Date()) {
            const created = []
            for (const s of seedEvents(now)) created.push(await insertWithPin(s))
            return { inserted: created.length, items: created.map(e => ({ _id: e._id, name: e.event.name, pin: e.event.pin })) }
        },

        async purge() {
            const { deletedCount } = await Event.deleteMany({})
            return { deleted: deletedCount }
        }
    }
}

// Sample events, placed relative to today so they show in the default list
function seedEvents(now) {
    const at = (days, h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, h, m)
    const fb = (ratings, extra = {}) => ({
        rating: Object.fromEntries(RATINGS.map((r, i) => [r, ratings[i]])),
        date: now,
        ...extra
    })
    return [
        {
            event: { name: 'Intro to MongoDB aggregation', location: 'Meeting room A', presenter: 'Alex Example', email: 'alex@example.com', start: at(0, 9, 30), end: at(0, 10, 30), notes: 'Pipelines, $group and $lookup with worked examples.' },
            feedback: [
                fb([5, 5, 4, 4, 5, 5], { notes: 'Clear and well paced.', name: 'Sam Sample' }),
                fb([4, 5, 4, 3, 4, 5], { notes: 'More time for questions next time.' }),
                fb([5, 4, 5, 5, 4, 4])
            ]
        },
        {
            event: { name: 'Home network security basics', location: 'Online', presenter: 'Jo Placeholder', email: 'jo@example.com', start: at(1, 14), end: at(1, 15, 30), notes: 'VLANs, firewall rules and keeping IoT devices apart.' },
            feedback: [fb([4, 4, 3, 4, 4, 5], { email: 'attendee@example.org' })]
        },
        {
            event: { name: 'Product photography workshop', location: 'Studio 2', presenter: 'Riley Demo', email: 'riley@example.com', start: at(7, 10), end: at(7, 12), notes: 'Lighting, white balance and editing. Bring a camera.' },
            feedback: []
        },
        {
            event: { name: 'Quarterly all-hands', location: 'Main hall', presenter: 'Morgan Test', email: 'morgan@example.com', start: at(14, 16), end: at(14, 17), notes: '' },
            feedback: []
        }
    ]
}

module.exports = { createEventsRepo, makePin, normalisePin, pickEvent, pickFeedback, summarise, encodeCursor, decodeCursor, PIN_ALPHABET, MAX_PAGE }
