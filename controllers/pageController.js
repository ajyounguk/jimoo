// GET pages. All state comes from the query string (?view, ?id, ?pin, ?result),
// never from server memory, so concurrent users can't see each other's data.

const express = require('express')
const { runAction: run } = require('../lib/run')

// attendee views hide the developer response panel
const ATTENDEE_VIEWS = ['pin', 'feedback', 'thanks']
const ADMIN_VIEWS = ['events', 'event', 'create', 'edit', 'delete', 'setup']
const VIEWS = [...ATTENDEE_VIEWS, ...ADMIN_VIEWS]

const q = v => (typeof v === 'string' && v ? v : undefined)

module.exports = function pageController({ events, results }) {
    const router = express.Router()

    router.get('/', async (req, res) => {
        const view = VIEWS.includes(req.query.view) ? req.query.view : 'pin'
        const result = q(req.query.result) ? results.take(req.query.result) : null
        const locals = {
            view,
            attendee: ATTENDEE_VIEWS.includes(view),
            result,
            event: null,
            list: null,
            lookup: null,
            pin: q(req.query.pin) || '',
            id: q(req.query.id) || ''
        }
        let status = 200

        if (view === 'feedback') {
            if (!locals.pin) return res.redirect(303, '/')
            locals.lookup = await run('find event', 200, () => events.findByPin(locals.pin))
            if (locals.lookup.ok) locals.event = locals.lookup.data
            else status = locals.lookup.status
        }

        if (view === 'events') {
            const { from, to, after, limit } = req.query
            locals.lookup = await run('list events', 200, () => events.list({ from: q(from), to: q(to), after: q(after), limit: q(limit) }))
            if (locals.lookup.ok) locals.list = locals.lookup.data
            else status = locals.lookup.status
        }

        if (view === 'event' || view === 'edit' || view === 'delete') {
            if (!locals.id) {
                if (view === 'event') return res.redirect(303, '/?view=events')
            } else {
                locals.lookup = await run('get event', 200, () => events.get(locals.id))
                if (locals.lookup.ok) locals.event = locals.lookup.data
                else status = locals.lookup.status
            }
        }

        // the response panel shows the POST result if there is one,
        // otherwise the lookup this page made
        locals.panel = locals.attendee ? null : (result || locals.lookup)
        res.status(status).render('index', locals)
    })

    // v1 entry point
    router.get('/admin', (req, res) => res.redirect(303, '/?view=events'))

    return router
}

module.exports.VIEWS = VIEWS
