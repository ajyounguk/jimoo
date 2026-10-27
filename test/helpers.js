const { createApp } = require('../app')
const { createResultStore } = require('../lib/results')
const { NotFoundError } = require('../lib/errors')
const { summarise } = require('../lib/events')

const ID = '64b7f0c2a1b2c3d4e5f60718'
const ID2 = '64b7f0c2a1b2c3d4e5f60719'
const NOW = new Date(2026, 9, 6, 14, 20) // 6 Oct 2026 14:20 local

function sampleEvent(overrides = {}) {
    return {
        _id: ID,
        event: {
            name: 'Intro to aggregation',
            location: 'Room A',
            presenter: 'Alex Example',
            email: 'alex@example.com',
            start: new Date(2026, 9, 7, 9, 30),
            end: new Date(2026, 9, 7, 10, 30),
            notes: 'Bring a laptop',
            pin: 'ABC23',
            deleted: false,
            ...overrides.event
        },
        feedback: overrides.feedback || [],
        ...(overrides._id ? { _id: overrides._id } : {})
    }
}

// In-memory stand-in for lib/events.js. Set fake.fail = { method: error }
// to make a method reject.
function fakeEvents(seed = []) {
    const rows = new Map(seed.map(e => [String(e._id), structuredClone(e)]))
    const fake = { fail: {}, calls: [], rows }
    const wrap = (name, fn) => async (...args) => {
        fake.calls.push([name, ...args])
        if (fake.fail[name]) throw fake.fail[name]
        return fn(...args)
    }
    const byPin = pin => [...rows.values()].find(e => e.event.pin === String(pin).toUpperCase() && !e.event.deleted)
    const live = id => {
        const e = rows.get(id)
        if (!e || e.event.deleted) throw new NotFoundError(`event ${id} not found`)
        return e
    }
    Object.assign(fake, {
        list: wrap('list', ({ from = '2026-10-01', to = '2026-11-30', limit } = {}) => ({
            items: [...rows.values()].filter(e => !e.event.deleted).map(e => ({
                _id: e._id, event: e.event, feedbackCount: e.feedback.length,
                averageRating: summarise(e.feedback).averages.event
            })),
            total: rows.size,
            limit: Number(limit) || 20,
            from,
            to,
            next: fake.nextCursor || null
        })),
        get: wrap('get', id => {
            const e = live(id)
            return { ...e, summary: summarise(e.feedback) }
        }),
        findByPin: wrap('findByPin', pin => {
            const e = byPin(pin)
            if (!e) throw new NotFoundError(`no event with PIN ${pin}`)
            const { name, presenter, location, start, end } = e.event
            return { pin: e.event.pin, name, presenter, location, start, end }
        }),
        create: wrap('create', body => {
            const e = { _id: ID2, event: { name: body.name, presenter: body.presenter, location: body.location, email: body.email, notes: body.notes, start: new Date(2026, 9, 8, 10), end: new Date(2026, 9, 8, 11), pin: 'NEW22', deleted: false }, feedback: [] }
            rows.set(ID2, e)
            return e
        }),
        update: wrap('update', (id, body) => {
            const before = structuredClone(live(id))
            const after = rows.get(id)
            for (const k of ['name', 'presenter', 'location', 'email', 'notes']) if (body[k] !== undefined) after.event[k] = body[k]
            return { before, after }
        }),
        remove: wrap('remove', id => {
            const e = live(id)
            e.event.deleted = true
            return e
        }),
        addFeedback: wrap('addFeedback', (pin, body) => {
            const e = byPin(pin)
            if (!e) throw new NotFoundError(`no event with PIN ${pin}`)
            const entry = { rating: { event: Number(body.event) }, notes: body.notes, date: NOW }
            e.feedback.push(entry)
            return { event: { pin: e.event.pin, name: e.event.name }, feedback: entry }
        }),
        seed: wrap('seed', () => ({ inserted: 4, items: [] })),
        purge: wrap('purge', () => ({ deleted: rows.size }))
    })
    return fake
}

function makeApp({ events = fakeEvents(), db, dbState = () => 'connected' } = {}) {
    const results = createResultStore()
    const app = createApp({
        events,
        db: db || { kind: 'local', label: '127.0.0.1:27017', db: 'jimoo', hosts: ['127.0.0.1'] },
        dbState,
        results,
        now: () => NOW
    })
    return { app, events, results }
}

const RATING_FORM = { event: '5', presenter: '4', engaging: '4', innovative: '3', inspiring: '5', informative: '4' }

module.exports = { fakeEvents, makeApp, sampleEvent, ID, ID2, NOW, RATING_FORM }
