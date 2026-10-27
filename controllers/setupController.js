// Seed and purge the events collection. In v1 these were GETs at
// /event/seed and /event/purge (and purge dropped the wrong collection);
// they change data, so they are POSTs now, covered by the same-origin check.

const express = require('express')
const { runAction } = require('../lib/run')

module.exports = function setupController({ events, results }) {
    const router = express.Router()

    async function handle(res, action, okStatus, fn) {
        const id = results.put(await runAction(action, okStatus, fn))
        res.redirect(303, `/?view=setup&result=${id}`)
    }

    router.post('/admin/setup/seed', (req, res) => handle(res, 'seed', 201, () => events.seed()))
    router.post('/admin/setup/purge', (req, res) => handle(res, 'purge', 200, () => events.purge()))

    return router
}
