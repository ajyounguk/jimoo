// Attendee feedback. The event is identified by the PIN in the form, not by
// whatever event was last looked up (v1 kept that in shared server state).

const express = require('express')
const { runAction } = require('../lib/run')

module.exports = function feedbackController({ events, results }) {
    const router = express.Router()

    router.post('/feedback', async (req, res) => {
        const body = req.body || {}
        const pin = typeof body.pin === 'string' ? body.pin : ''
        const result = await runAction('feedback', 201, () => events.addFeedback(pin, body))
        const id = results.put(result)
        if (result.ok) return res.redirect(303, `/?view=thanks&result=${id}`)
        // back to the form (or the PIN page if the PIN itself is the problem)
        const back = result.status === 400 && pin ? `view=feedback&pin=${encodeURIComponent(pin)}` : 'view=pin'
        res.redirect(303, `/?${back}&result=${id}`)
    })

    return router
}
