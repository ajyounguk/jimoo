// Repository tests against a throwaway mongod (mongodb-memory-server),
// bound to 127.0.0.1 on a random port and deleted afterwards.

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const request = require('supertest')

const { createEventsRepo, makePin, PIN_ALPHABET } = require('../lib/events')
const { createApp } = require('../app')
const Event = require('../models/eventModel')
const { RATING_FORM } = require('./helpers')

let mongod
const events = createEventsRepo(Event)

before(async () => {
    mongod = await MongoMemoryServer.create()
    mongoose.set('bufferCommands', false)
    mongoose.set('strictQuery', true)
    mongoose.set('sanitizeFilter', true)
    await mongoose.connect(mongod.getUri('jimoo-test'))
    await Event.init() // build the unique PIN index
})

after(async () => {
    await mongoose.disconnect()
    await mongod.stop()
})

beforeEach(() => Event.deleteMany({}))

const form = (o = {}) => ({
    name: 'Talk', presenter: 'Alex Example', location: 'Room A', email: 'alex@example.com',
    startdate: '2026-10-07', starttime: '09:30', enddate: '2026-10-07', endtime: '10:30', notes: 'n',
    ...o
})

describe('events repository: create and read', () => {
    it('creates an event with a 5-char PIN from the unambiguous alphabet, no __v', async () => {
        const e = await events.create(form())
        assert.match(e.event.pin, /^[A-Z2-9]{5}$/)
        assert.ok([...e.event.pin].every(c => PIN_ALPHABET.includes(c)))
        assert.equal(e.__v, undefined)
        assert.equal(e.event.deleted, false)
        assert.deepEqual(e.event.start, new Date(2026, 9, 7, 9, 30))
        assert.deepEqual(e.feedback, [])
        const got = await events.get(String(e._id))
        assert.equal(got.event.name, 'Talk')
        assert.deepEqual(got.summary, { count: 0, averages: { event: null, presenter: null, engaging: null, innovative: null, inspiring: null, informative: null } })
    })

    it('rejects bad input', async () => {
        await assert.rejects(events.create(form({ name: '' })), { name: 'ValidationError' })
        await assert.rejects(events.create(form({ email: 'not-an-email' })), { name: 'ValidationError' })
        await assert.rejects(events.create(form({ startdate: '2026-02-30' })), { name: 'BadRequestError' })
        await assert.rejects(events.create(form({ starttime: '25:00' })), { name: 'BadRequestError' })
        await assert.rejects(events.create(form({ endtime: '09:00' })), { name: 'BadRequestError', message: /end must not be before start/ })
    })

    it('ignores unknown fields and operator objects', async () => {
        const e = await events.create({ ...form(), deleted: 'true', pin: 'AAAAA', _id: 'x' })
        assert.notEqual(e.event.pin, 'AAAAA')
        assert.equal(e.event.deleted, false)
        const injected = await events.create(form({ name: { $gt: '' } }))
        assert.equal(injected.event.name, '[object Object]')
    })

    it('retries on a PIN collision', async () => {
        // first two PINs collide with an existing live event, the third is new
        const seq = [...'AAAAA', ...'AAAAA', ...'BBBBB'].map(c => PIN_ALPHABET.indexOf(c))
        const repo = createEventsRepo(Event, { randomInt: () => seq.shift() })
        await events.create(form())
        await Event.updateOne({}, { $set: { 'event.pin': 'AAAAA' } })
        const e = await repo.create(form())
        assert.equal(e.event.pin, 'BBBBB')
    })

    it('retries when the insert itself hits the unique index (race)', async () => {
        // exists() says free, but another request inserted the PIN first
        let inserts = 0
        const RacyEvent = {
            exists: async () => null,
            create: async doc => {
                if (inserts++ === 0) throw Object.assign(new Error('E11000'), { code: 11000, keyPattern: { 'event.pin': 1 } })
                return doc
            }
        }
        const e = await createEventsRepo(RacyEvent).create(form())
        assert.equal(inserts, 2)
        assert.match(e.event.pin, /^[A-Z2-9]{5}$/)
    })

    it('gives up after 20 collisions instead of looping or answering twice', async () => {
        await events.create(form())
        await Event.updateMany({}, { $set: { 'event.pin': 'AAAAA' } })
        const repo = createEventsRepo(Event, { randomInt: () => 0 }) // always 'AAAAA'
        await assert.rejects(repo.create(form()), /after 20 attempts/)
    })

    it('enforces unique PINs among live events at the index level', async () => {
        const a = await events.create(form())
        await assert.rejects(
            Event.create({ event: { ...a.event, pin: a.event.pin } }),
            err => err.code === 11000
        )
        // a soft-deleted event's PIN may be reused
        await events.remove(String(a._id))
        await Event.create({ event: { ...a.event, deleted: false } })
    })

    it('404s for unknown or soft-deleted ids and 400s for invalid ones', async () => {
        const e = await events.create(form())
        await events.remove(String(e._id))
        await assert.rejects(events.get(String(e._id)), { name: 'NotFoundError' })
        await assert.rejects(events.get('64b7f0c2a1b2c3d4e5f6ffff'), { name: 'NotFoundError' })
        await assert.rejects(events.get('nope'), { name: 'BadRequestError' })
        await assert.rejects(events.get({ $ne: null }), { name: 'BadRequestError' })
    })

    it('makePin draws from the alphabet', () => {
        assert.equal(makePin(() => 0), 'AAAAA')
        assert.equal(makePin(n => n - 1), '99999')
    })
})

describe('events repository: list', () => {
    async function seedDays(n) {
        for (let d = 1; d <= n; d++) await events.create(form({ name: `Day ${d}`, startdate: `2026-10-${String(d).padStart(2, '0')}`, enddate: `2026-10-${String(d).padStart(2, '0')}` }))
    }

    it('filters by inclusive date range, sorted by start', async () => {
        await seedDays(5)
        await events.create(form({ name: 'November', startdate: '2026-11-01', enddate: '2026-11-01' }))
        const r = await events.list({ from: '2026-10-02', to: '2026-10-04' })
        assert.deepEqual(r.items.map(e => e.event.name), ['Day 2', 'Day 3', 'Day 4'])
        assert.equal(r.total, 3)
        assert.equal(r.next, null)
        assert.equal(r.from, '2026-10-02')
    })

    it('paginates with a keyset cursor, including events with the same start', async () => {
        await seedDays(5)
        await events.create(form({ name: 'Day 3b', startdate: '2026-10-03', enddate: '2026-10-03' }))
        const range = { from: '2026-10-01', to: '2026-10-31', limit: 2 }
        const names = []
        let page = await events.list(range)
        names.push(...page.items.map(e => e.event.name))
        while (page.next) {
            page = await events.list({ ...range, after: page.next })
            names.push(...page.items.map(e => e.event.name))
        }
        assert.deepEqual(names, ['Day 1', 'Day 2', 'Day 3', 'Day 3b', 'Day 4', 'Day 5'])
        assert.equal(page.total, 6)
    })

    it('hides soft-deleted events and reports feedback count and average', async () => {
        const a = await events.create(form({ name: 'A' }))
        const b = await events.create(form({ name: 'B' }))
        await events.remove(String(b._id))
        await events.addFeedback(a.event.pin, { ...RATING_FORM, event: '4' })
        await events.addFeedback(a.event.pin, { ...RATING_FORM, event: '5' })
        const r = await events.list({ from: '2026-10-01', to: '2026-10-31' })
        assert.equal(r.items.length, 1)
        assert.equal(r.items[0].feedbackCount, 2)
        assert.equal(r.items[0].averageRating, 4.5)
        assert.equal(r.items[0].feedback, undefined) // list doesn't load feedback bodies
    })

    it('defaults to this month and next, clamps the page size, and rejects bad input', async () => {
        const r = await events.list({ limit: '1000' })
        assert.equal(r.limit, 100)
        assert.match(r.from, /^\d{4}-\d{2}-01$/)
        await assert.rejects(events.list({ from: '2026-10-10', to: '2026-10-01' }), { name: 'BadRequestError' })
        await assert.rejects(events.list({ from: 'yesterday' }), { name: 'BadRequestError' })
        await assert.rejects(events.list({ after: 'garbage' }), { name: 'BadRequestError' })
    })
})

describe('events repository: update and delete', () => {
    it('updates details but keeps the PIN and existing feedback', async () => {
        const e = await events.create(form())
        await events.addFeedback(e.event.pin, RATING_FORM)
        const { before, after } = await events.update(String(e._id), form({ name: 'Renamed', starttime: '11:00', endtime: '12:00' }))
        assert.equal(before.event.name, 'Talk')
        assert.equal(after.event.name, 'Renamed')
        assert.equal(after.event.pin, e.event.pin)
        assert.equal(after.feedback.length, 1)
        assert.deepEqual(after.event.start, new Date(2026, 9, 7, 11, 0))
    })

    it('validates updates', async () => {
        const e = await events.create(form())
        await assert.rejects(events.update(String(e._id), form({ email: 'bad' })), { name: 'ValidationError' })
        await assert.rejects(events.update(String(e._id), form({ endtime: '08:00' })), { name: 'BadRequestError' })
        await assert.rejects(events.update('64b7f0c2a1b2c3d4e5f6ffff', form()), { name: 'NotFoundError' })
    })

    it('soft-deletes: the document stays, the PIN stops working', async () => {
        const e = await events.create(form())
        const removed = await events.remove(String(e._id))
        assert.equal(removed.event.deleted, true)
        assert.ok(removed.event.deletedAt instanceof Date)
        assert.equal(await Event.countDocuments(), 1)
        await assert.rejects(events.findByPin(e.event.pin), { name: 'NotFoundError' })
        await assert.rejects(events.remove(String(e._id)), { name: 'NotFoundError' })
    })
})

describe('events repository: feedback', () => {
    it('finds an event by PIN, case-insensitively, without private fields', async () => {
        const e = await events.create(form())
        await events.addFeedback(e.event.pin, { ...RATING_FORM, notes: 'private note' })
        const found = await events.findByPin(e.event.pin.toLowerCase())
        assert.deepEqual(Object.keys(found).sort(), ['end', 'location', 'name', 'pin', 'presenter', 'start'])
        await assert.rejects(events.findByPin('ZZZZ'), { name: 'BadRequestError' })
        await assert.rejects(events.findByPin({ $ne: '' }), { name: 'BadRequestError' })
        await assert.rejects(events.findByPin('ZZZZZ'), { name: 'NotFoundError' })
    })

    it('stores feedback with all six ratings and optional details, and summarises it', async () => {
        const e = await events.create(form())
        const r = await events.addFeedback(e.event.pin, { ...RATING_FORM, notes: '  ', name: 'Sam', email: 'sam@example.com' })
        assert.equal(r.event.name, 'Talk')
        assert.equal(r.feedback.notes, undefined)
        await events.addFeedback(e.event.pin, { ...RATING_FORM, event: '2' })
        const got = await events.get(String(e._id))
        assert.equal(got.feedback.length, 2)
        assert.equal(got.feedback[0].name, 'Sam')
        assert.equal(got.summary.count, 2)
        assert.equal(got.summary.averages.event, 3.5)
        assert.equal(got.summary.averages.innovative, 3)
    })

    it('rejects missing or out-of-range ratings', async () => {
        const e = await events.create(form())
        await assert.rejects(events.addFeedback(e.event.pin, { event: '5' }), { name: 'BadRequestError', message: /presenter, engaging/ })
        await assert.rejects(events.addFeedback(e.event.pin, { ...RATING_FORM, event: '6' }), { name: 'BadRequestError' })
        await assert.rejects(events.addFeedback(e.event.pin, { ...RATING_FORM, event: '2.5' }), { name: 'BadRequestError' })
        assert.equal((await events.get(String(e._id))).feedback.length, 0)
    })

    it('rejects over-long comments via schema validation', async () => {
        const e = await events.create(form())
        await assert.rejects(events.addFeedback(e.event.pin, { ...RATING_FORM, notes: 'x'.repeat(2001) }), { name: 'ValidationError' })
    })

    it('404s for an unknown or deleted event', async () => {
        await assert.rejects(events.addFeedback('ZZZZZ', RATING_FORM), { name: 'NotFoundError' })
    })
})

describe('events repository: seed and purge', () => {
    it('seeds four events dated from today with unique PINs, visible in the default list', async () => {
        const r = await events.seed()
        assert.equal(r.inserted, 4)
        assert.equal(new Set(r.items.map(i => i.pin)).size, 4)
        const list = await events.list()
        assert.equal(list.total, 4)
        // seeding twice still works (fresh PINs)
        await events.seed()
        assert.equal(await Event.countDocuments(), 8)
    })

    it('purges every document, including soft-deleted ones', async () => {
        const e = await events.create(form())
        await events.remove(String(e._id))
        await events.create(form())
        assert.deepEqual(await events.purge(), { deleted: 2 })
    })

    it('reads a v1-shaped document (with __v, partial ratings, feedback _id)', async () => {
        const id = new mongoose.Types.ObjectId()
        await Event.collection.insertOne({
            _id: id, __v: 0,
            event: { name: 'Old', location: 'L', presenter: 'P', email: 'old@example.com', start: new Date(2026, 9, 7, 9), end: new Date(2026, 9, 7, 10), notes: 'n', pin: 'OLDPN', deleted: false },
            feedback: [{ _id: new mongoose.Types.ObjectId(), rating: { event: 5 }, notes: 'ok', date: new Date() }]
        })
        const got = await events.get(String(id))
        assert.equal(got.__v, undefined)
        assert.equal(got.summary.averages.event, 5)
        assert.equal(got.summary.averages.presenter, null)
        assert.equal((await events.findByPin('oldpn')).name, 'Old')
        const { after } = await events.update(String(id), form({ name: 'Updated' }))
        assert.equal(after.feedback.length, 1)
    })
})

describe('end to end against MongoDB', () => {
    it('create -> PIN -> feedback -> list -> delete through the HTTP app', async () => {
        const app = createApp({
            events,
            db: { kind: 'local', label: '127.0.0.1', db: 'jimoo-test', hosts: [] },
            dbState: () => 'connected'
        })
        const created = await request(app).post('/admin/events').type('form').send(form({ name: 'E2E talk' }))
        assert.equal(created.status, 303)
        const id = /id=([0-9a-f]{24})/.exec(created.headers.location)[1]
        const page = await request(app).get(created.headers.location)
        const pin = /id="event-pin">([A-Z0-9]{5})</.exec(page.text)[1]

        const fb = await request(app).post('/feedback').type('form').send({ pin: pin.toLowerCase(), ...RATING_FORM })
        assert.match(fb.headers.location, /view=thanks/)

        const list = await request(app).get('/?view=events&from=2026-10-01&to=2026-10-31')
        assert.match(list.text, /E2E talk/)
        assert.match(list.text, /1 <span class="muted">response · avg 5\/5/)

        const del = await request(app).post('/admin/events/delete').type('form').send({ id })
        assert.equal(del.status, 303)
        const gone = await request(app).get(`/?view=feedback&pin=${pin}`)
        assert.equal(gone.status, 404)
    })
})
