// Event admin: create, update, soft delete. Every handler catches its own
// errors and always responds (303 to a GET that shows the result).

const express = require('express')
const { runAction: run } = require('../lib/run')

module.exports = function eventAdminController({ events, results }) {
    const router = express.Router()

    function redirect(res, query, result) {
        res.redirect(303, `/?${query}&result=${results.put(result)}`)
    }
    const idOf = body => (typeof body.id === 'string' ? body.id : '')

    // on failure, keep what was typed so the form can be re-filled
    const FORM_FIELDS = ['name', 'presenter', 'location', 'email', 'notes', 'startdate', 'starttime', 'enddate', 'endtime']
    function withInput(result, body) {
        if (result.ok) return result
        const input = {}
        for (const f of FORM_FIELDS) if (typeof body[f] === 'string') input[f] = body[f]
        return { ...result, input }
    }

    router.post('/admin/events', async (req, res) => {
        const body = req.body || {}
        const result = withInput(await run('create event', 201, () => events.create(body)), body)
        if (result.ok) redirect(res, `view=event&id=${result.data._id}`, result)
        else redirect(res, 'view=create', result)
    })

    router.post('/admin/events/update', async (req, res) => {
        const body = req.body || {}
        const id = idOf(body)
        const result = withInput(await run('update event', 200, () => events.update(id, body)), body)
        const target = encodeURIComponent(id)
        if (result.ok) redirect(res, `view=event&id=${target}`, result)
        else redirect(res, `view=edit&id=${target}`, result)
    })

    router.post('/admin/events/delete', async (req, res) => {
        const result = await run('delete event', 200, () => events.remove(idOf(req.body || {})))
        redirect(res, 'view=events', result)
    })

    return router
}
