const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const mongoose = require('mongoose')

const { fakeEvents, makeApp, sampleEvent, ID, ID2, RATING_FORM } = require('./helpers')
const { NotFoundError, BadRequestError } = require('../lib/errors')

const EVENT_FORM = {
    name: 'New talk', presenter: 'Jo Placeholder', location: 'Online', email: 'jo@example.com',
    startdate: '2026-10-08', starttime: '10:00', enddate: '2026-10-08', endtime: '11:00', notes: ''
}

// Follow a 303 from a POST and return the rendered page
async function postAndFollow(app, path, form) {
    const post = await request(app).post(path).type('form').send(form)
    assert.equal(post.status, 303, post.text)
    assert.match(post.headers.location, /^\/\?view=\w+(&(id|pin)=[^&]+)?&result=[0-9a-f-]{36}$/)
    const page = await request(app).get(post.headers.location)
    return { post, page }
}

function serverSelectionError() {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:27017')
    err.name = 'MongooseServerSelectionError'
    return err
}

const withEvent = (o = {}) => makeApp({ events: fakeEvents([sampleEvent(o)]) })

describe('GET / (attendee)', () => {
    it('shows the PIN form by default with sidebar and badge, and no response panel', async () => {
        const { app } = makeApp()
        const res = await request(app).get('/')
        assert.equal(res.status, 200)
        assert.match(res.text, /<h2>Give feedback<\/h2>/)
        assert.match(res.text, /class="sidebar"/)
        assert.match(res.text, /env-badge env-local/)
        assert.match(res.text, /127\.0\.0\.1:27017 \/ jimoo/)
        assert.doesNotMatch(res.text, /<h2>Response<\/h2>/)
    })

    it('falls back to the PIN form for an unknown view', async () => {
        const { app } = makeApp()
        const res = await request(app).get('/?view=../../etc/passwd')
        assert.equal(res.status, 200)
        assert.match(res.text, /<h2>Give feedback<\/h2>/)
    })

    it('shows the feedback form for a PIN, case-insensitively, with unique radio ids', async () => {
        const { app, events } = withEvent()
        const res = await request(app).get('/?view=feedback&pin=abc23')
        assert.equal(res.status, 200)
        assert.deepEqual(events.calls[0], ['findByPin', 'abc23'])
        assert.match(res.text, /Intro to aggregation/)
        assert.match(res.text, /name="pin" value="ABC23"/)
        for (const r of ['event', 'presenter', 'engaging', 'innovative', 'inspiring', 'informative']) {
            for (let n = 1; n <= 5; n++) assert.match(res.text, new RegExp(`id="rate-${r}-${n}" value="${n}"`))
        }
        const ids = [...res.text.matchAll(/ id="([^"]+)"/g)].map(m => m[1])
        assert.equal(new Set(ids).size, ids.length, 'duplicate ids')
    })

    it('does not show the contact email, notes or other feedback to attendees', async () => {
        const { app } = withEvent({ feedback: [{ rating: { event: 1 }, notes: 'secret note', email: 'other@example.org' }] })
        const res = await request(app).get('/?view=feedback&pin=ABC23')
        assert.doesNotMatch(res.text, /alex@example\.com|Bring a laptop|secret note|other@example\.org/)
    })

    it('returns 404 with a friendly message for an unknown PIN', async () => {
        const { app } = withEvent()
        const res = await request(app).get('/?view=feedback&pin=ZZZZZ')
        assert.equal(res.status, 404)
        assert.match(res.text, /no event with PIN ZZZZZ/)
        assert.match(res.text, /id="pin-input"[^>]*value="ZZZZZ"/)
    })

    it('returns 400 for a malformed PIN and 503 when the database is down', async () => {
        const events = fakeEvents()
        events.fail.findByPin = new BadRequestError('PIN must be 5 letters or digits')
        let res = await request(makeApp({ events }).app).get('/?view=feedback&pin=!!')
        assert.equal(res.status, 400)
        events.fail.findByPin = serverSelectionError()
        res = await request(makeApp({ events }).app).get('/?view=feedback&pin=ABC23')
        assert.equal(res.status, 503)
        assert.match(res.text, /notice-err/)
    })

    it('redirects view=feedback without a PIN to /', async () => {
        const res = await request(makeApp().app).get('/?view=feedback')
        assert.equal(res.status, 303)
        assert.equal(res.headers.location, '/')
    })
})

describe('POST /feedback', () => {
    it('saves feedback for the PIN in the form and shows thanks (post/redirect/get)', async () => {
        const { app, events } = withEvent()
        const { post, page } = await postAndFollow(app, '/feedback', { pin: 'ABC23', ...RATING_FORM, notes: 'Great' })
        assert.match(post.headers.location, /^\/\?view=thanks&result=/)
        assert.equal(events.calls[0][0], 'addFeedback')
        assert.equal(events.calls[0][1], 'ABC23')
        assert.equal(events.rows.get(ID).feedback.length, 1)
        assert.match(page.text, /Thanks for your feedback!/)
        assert.match(page.text, /<strong>Intro to aggregation<\/strong>/)
        // a refresh doesn't re-submit or re-show the result
        const again = await request(app).get(post.headers.location)
        assert.doesNotMatch(again.text, /<strong>Intro to aggregation<\/strong>/)
    })

    it('two attendees on different events each reach their own event', async () => {
        const a = sampleEvent()
        const b = sampleEvent({ _id: ID2, event: { name: 'Other talk', pin: 'XYZ99' } })
        const { app, events } = makeApp({ events: fakeEvents([a, b]) })
        // attendee 1 looks up A, attendee 2 looks up B, then attendee 1 submits
        await request(app).get('/?view=feedback&pin=ABC23')
        await request(app).get('/?view=feedback&pin=XYZ99')
        await postAndFollow(app, '/feedback', { pin: 'ABC23', ...RATING_FORM })
        assert.equal(events.rows.get(ID).feedback.length, 1)
        assert.equal(events.rows.get(ID2).feedback.length, 0)
    })

    it('goes back to the form with the error for a missing rating', async () => {
        const events = fakeEvents([sampleEvent()])
        events.fail.addFeedback = new BadRequestError('rate each of: inspiring (1 to 5)')
        const { app } = makeApp({ events })
        const { post, page } = await postAndFollow(app, '/feedback', { pin: 'ABC23', event: '5' })
        assert.match(post.headers.location, /view=feedback&pin=ABC23&result=/)
        assert.match(page.text, /<strong>400<\/strong> rate each of: inspiring/)
        assert.match(page.text, /Send feedback/)
    })

    it('goes back to the PIN page when the event has gone', async () => {
        const events = fakeEvents()
        events.fail.addFeedback = new NotFoundError('no event with PIN ABC23')
        const { post, page } = await postAndFollow(makeApp({ events }).app, '/feedback', { pin: 'ABC23', ...RATING_FORM })
        assert.match(post.headers.location, /^\/\?view=pin&result=/)
        assert.match(page.text, /<strong>404<\/strong> no event with PIN ABC23/)
    })

    it('handles an empty body', async () => {
        const events = fakeEvents()
        events.fail.addFeedback = new BadRequestError('PIN must be 5 letters or digits')
        const post = await request(makeApp({ events }).app).post('/feedback')
        assert.equal(post.status, 303)
        assert.match(post.headers.location, /^\/\?view=pin&result=/)
    })
})

describe('GET /?view=events (list)', () => {
    it('lists events with PIN, feedback count, links and a response panel', async () => {
        const { app, events } = withEvent({ feedback: [{ rating: { event: 4 } }, { rating: { event: 5 } }] })
        const res = await request(app).get('/?view=events&from=2026-10-01&to=2026-10-31&limit=5')
        assert.equal(res.status, 200)
        assert.deepEqual(events.calls[0], ['list', { from: '2026-10-01', to: '2026-10-31', after: undefined, limit: '5' }])
        assert.match(res.text, /Intro to aggregation/)
        assert.match(res.text, /<span class="pin-chip">ABC23<\/span>/)
        assert.match(res.text, /2 <span class="muted">responses · avg 4\.5\/5<\/span>/)
        assert.match(res.text, new RegExp(`href="/\\?view=edit&amp;id=${ID}"`))
        assert.match(res.text, new RegExp(`href="/\\?view=delete&amp;id=${ID}"`))
        assert.match(res.text, /id="list-from" name="from" value="2026-10-01"/)
        assert.match(res.text, /status-ok">200</)
        assert.doesNotMatch(res.text, /Next page/)
    })

    it('renders a next-page link carrying the cursor and range', async () => {
        const events = fakeEvents([sampleEvent()])
        events.nextCursor = `1791358200000_${ID}`
        const res = await request(makeApp({ events }).app).get('/?view=events')
        assert.match(res.text, new RegExp(`href="/\\?view=events&amp;from=2026-10-01&amp;to=2026-11-30&amp;limit=20&amp;after=1791358200000_${ID}">Next page`))
    })

    it('passes the after cursor through', async () => {
        const { app, events } = withEvent()
        await request(app).get(`/?view=events&after=1_${ID}`)
        assert.equal(events.calls[0][1].after, `1_${ID}`)
    })

    it('shows an empty state', async () => {
        const res = await request(makeApp().app).get('/?view=events')
        assert.match(res.text, /No events in this range/)
    })

    it('returns 400 for a bad range and 503 when MongoDB is unreachable', async () => {
        const events = fakeEvents()
        events.fail.list = new BadRequestError('to must not be before from')
        let res = await request(makeApp({ events }).app).get('/?view=events&from=2026-10-10&to=2026-10-01')
        assert.equal(res.status, 400)
        assert.match(res.text, /BadRequestError/)
        events.fail.list = serverSelectionError()
        res = await request(makeApp({ events }).app).get('/?view=events')
        assert.equal(res.status, 503)
        assert.match(res.text, /status-err">503</)
        assert.match(res.text, /MongooseServerSelectionError/)
        assert.match(res.text, /Couldn't load the list/)
    })

    it('keeps /admin as a redirect to the list', async () => {
        const res = await request(makeApp().app).get('/admin')
        assert.equal(res.status, 303)
        assert.equal(res.headers.location, '/?view=events')
    })
})

describe('GET /?view=event (detail)', () => {
    it('shows the PIN, details and feedback summary', async () => {
        const fb = [
            { rating: { event: 5, presenter: 4, engaging: 4, innovative: 3, inspiring: 5, informative: 4 }, notes: 'Loved it', name: 'Sam', date: new Date(2026, 9, 7, 11) },
            { rating: { event: 4, presenter: 4, engaging: 5, innovative: 3, inspiring: 4, informative: 4 }, date: new Date(2026, 9, 7, 11) }
        ]
        const { app } = withEvent({ feedback: fb })
        const res = await request(app).get(`/?view=event&id=${ID}`)
        assert.equal(res.status, 200)
        assert.match(res.text, /id="event-pin">ABC23</)
        assert.match(res.text, /alex@example\.com/)
        assert.match(res.text, /2 responses/)
        assert.match(res.text, /<meter class="score-bar"[^>]*value="4\.5"><\/meter>/)
        assert.match(res.text, /Loved it/)
        assert.match(res.text, /anonymous/)
    })

    it('returns 404 for an unknown id and 400 for an invalid one', async () => {
        let res = await request(withEvent().app).get(`/?view=event&id=${ID2}`)
        assert.equal(res.status, 404)
        assert.match(res.text, /Couldn't load this event/)
        const events = fakeEvents()
        events.fail.get = new BadRequestError("'nope' is not a valid event id")
        res = await request(makeApp({ events }).app).get('/?view=event&id=nope')
        assert.equal(res.status, 400)
    })

    it('redirects to the list without an id', async () => {
        const res = await request(makeApp().app).get('/?view=event')
        assert.equal(res.status, 303)
        assert.equal(res.headers.location, '/?view=events')
    })
})

describe('create', () => {
    it('pre-fills today and the next full hour', async () => {
        const res = await request(makeApp().app).get('/?view=create')
        assert.match(res.text, /id="create-startdate" name="startdate" value="2026-10-06"/)
        assert.match(res.text, /id="create-starttime" name="starttime" value="15:00"/)
        assert.match(res.text, /id="create-endtime" name="endtime" value="16:00"/)
        assert.match(res.text, /action="\/admin\/events"/)
    })

    it('creates and redirects to the event page showing the new PIN and 201', async () => {
        const { app, events } = makeApp()
        const { post, page } = await postAndFollow(app, '/admin/events', EVENT_FORM)
        assert.match(post.headers.location, new RegExp(`^/\\?view=event&id=${ID2}&result=`))
        assert.equal(events.calls[0][0], 'create')
        assert.equal(events.calls[0][1].name, 'New talk')
        assert.match(page.text, /id="event-pin">NEW22</)
        assert.match(page.text, /status-ok">201<\/span>\s*<span class="muted">create event</)
        assert.match(page.text, /Request ID <code>[0-9a-f-]{36}<\/code>/)
    })

    it('shows a validation error and keeps what was typed', async () => {
        const events = fakeEvents()
        const err = new mongoose.Error.ValidationError()
        err.addError('event.email', new mongoose.Error.ValidatorError({ path: 'event.email', message: 'email must look like name@example.com' }))
        events.fail.create = err
        const { post, page } = await postAndFollow(makeApp({ events }).app, '/admin/events', { ...EVENT_FORM, email: 'nope', starttime: '09:15' })
        assert.match(post.headers.location, /^\/\?view=create&result=/)
        assert.match(page.text, /status-err">400</)
        assert.match(page.text, /&#34;fields&#34;/)
        assert.match(page.text, /name="email" value="nope"/)
        assert.match(page.text, /name="starttime" value="09:15"/)
        assert.match(page.text, /name="name" value="New talk"/)
    })

    it('maps a duplicate key to 409', async () => {
        const events = fakeEvents()
        events.fail.create = Object.assign(new Error('E11000 duplicate key'), { name: 'MongoServerError', code: 11000 })
        const { page } = await postAndFollow(makeApp({ events }).app, '/admin/events', EVENT_FORM)
        assert.match(page.text, /status-err">409</)
    })
})

describe('edit', () => {
    it("pre-fills the form from the event, including its own date and time", async () => {
        const res = await request(withEvent().app).get(`/?view=edit&id=${ID}`)
        assert.match(res.text, new RegExp(`name="id" value="${ID}"`))
        assert.match(res.text, /id="edit-name" name="name" value="Intro to aggregation"/)
        assert.match(res.text, /id="edit-startdate" name="startdate" value="2026-10-07"/)
        assert.match(res.text, /id="edit-starttime" name="starttime" value="09:30"/)
        assert.match(res.text, /id="edit-endtime" name="endtime" value="10:30"/)
        assert.match(res.text, /Bring a laptop<\/textarea>/)
        assert.match(res.text, /action="\/admin\/events\/update"/)
    })

    it('asks for an event when there is no id', async () => {
        const res = await request(makeApp().app).get('/?view=edit')
        assert.equal(res.status, 200)
        assert.match(res.text, /Pick an event to edit/)
    })

    it('updates and shows before and after', async () => {
        const { app, events } = withEvent()
        const { post, page } = await postAndFollow(app, '/admin/events/update', { id: ID, ...EVENT_FORM, name: 'Renamed' })
        assert.match(post.headers.location, new RegExp(`^/\\?view=event&id=${ID}&result=`))
        assert.equal(events.calls[0][0], 'update')
        assert.equal(events.calls[0][1], ID)
        assert.match(page.text, /status-ok">200</)
        assert.match(page.text, /&#34;before&#34;/)
        assert.match(page.text, /<h2>Renamed<\/h2>/)
    })

    it('goes back to the edit form on error', async () => {
        const events = fakeEvents([sampleEvent()])
        events.fail.update = new BadRequestError('end must not be before start')
        const { post, page } = await postAndFollow(makeApp({ events }).app, '/admin/events/update', { id: ID, ...EVENT_FORM, endtime: '09:00' })
        assert.match(post.headers.location, new RegExp(`^/\\?view=edit&id=${ID}&result=`))
        assert.match(page.text, /end must not be before start/)
        assert.match(page.text, /name="endtime" value="09:00"/)
    })

    it('shows 404 when the event does not exist', async () => {
        const events = fakeEvents()
        events.fail.update = new NotFoundError(`event ${ID} not found`)
        const { page } = await postAndFollow(makeApp({ events }).app, '/admin/events/update', { id: ID, ...EVENT_FORM })
        assert.match(page.text, /status-err">404</)
    })
})

describe('delete', () => {
    it('shows the event, a confirm dialog and a red button', async () => {
        const res = await request(withEvent().app).get(`/?view=delete&id=${ID}`)
        assert.match(res.text, /Intro to aggregation/)
        assert.match(res.text, /data-confirm="Delete this event\?/)
        assert.match(res.text, /class="btn btn-danger">Delete event</)
        assert.match(res.text, new RegExp(`name="id" value="${ID}"`))
    })

    it('soft-deletes and returns to the list', async () => {
        const { app, events } = withEvent()
        const { post, page } = await postAndFollow(app, '/admin/events/delete', { id: ID })
        assert.match(post.headers.location, /^\/\?view=events&result=/)
        assert.deepEqual(events.calls[0], ['remove', ID])
        assert.equal(events.rows.get(ID).event.deleted, true)
        assert.match(page.text, /status-ok">200<\/span>\s*<span class="muted">delete event</)
        assert.match(page.text, /No events in this range/)
    })

    it('shows 404 for a missing event and 503 when the database is down', async () => {
        const events = fakeEvents()
        events.fail.remove = new NotFoundError('event x not found')
        let r = await postAndFollow(makeApp({ events }).app, '/admin/events/delete', { id: ID })
        assert.match(r.page.text, /status-err">404</)
        events.fail.remove = serverSelectionError()
        r = await postAndFollow(makeApp({ events }).app, '/admin/events/delete', { id: ID })
        assert.match(r.page.text, /status-err">503</)
    })

    it('no longer deletes on GET (v1 routes are gone)', async () => {
        const { app, events } = withEvent()
        assert.equal((await request(app).get('/admin/event/delete-confirm-ok')).status, 404)
        assert.equal((await request(app).get(`/admin/event/delete/${ID}`)).status, 404)
        assert.equal(events.calls.length, 0)
    })
})

describe('setup', () => {
    it('renders seed and purge with a confirm on purge', async () => {
        const res = await request(makeApp().app).get('/?view=setup')
        assert.match(res.text, /action="\/admin\/setup\/seed"/)
        assert.match(res.text, /action="\/admin\/setup\/purge" data-confirm=/)
    })

    it('seeds and shows 201', async () => {
        const { post, page } = await postAndFollow(makeApp().app, '/admin/setup/seed', {})
        assert.match(post.headers.location, /view=setup/)
        assert.match(page.text, /status-ok">201</)
        assert.match(page.text, /&#34;inserted&#34;: 4/)
    })

    it('purges and shows the deleted count', async () => {
        const { page } = await postAndFollow(withEvent().app, '/admin/setup/purge', {})
        assert.match(page.text, /&#34;deleted&#34;: 1/)
    })

    it('maps an auth failure on purge to 403', async () => {
        const events = fakeEvents()
        events.fail.purge = Object.assign(new Error('not authorized on jimoo to execute command'), { name: 'MongoServerError', code: 13, codeName: 'Unauthorized' })
        const { page } = await postAndFollow(makeApp({ events }).app, '/admin/setup/purge', {})
        assert.match(page.text, /status-err">403</)
        assert.match(page.text, /Unauthorized/)
    })

    it('no longer accepts the v1 GET seed and purge', async () => {
        const { app, events } = makeApp()
        assert.equal((await request(app).get('/event/seed')).status, 404)
        assert.equal((await request(app).get('/event/purge')).status, 404)
        assert.equal((await request(app).get('/admin/setup/purge')).status, 404)
        assert.equal(events.calls.length, 0)
    })
})

describe('environment badge', () => {
    it('is red for Atlas and amber for a custom host, with connection state', async () => {
        let res = await request(makeApp({ db: { kind: 'atlas', label: 'cluster0.example.mongodb.net', db: 'prod', hosts: [] } }).app).get('/')
        assert.match(res.text, /env-badge env-atlas/)
        assert.match(res.text, /Atlas/)
        res = await request(makeApp({ db: { kind: 'custom', label: 'db.example.com:27017', db: 'x', hosts: [] }, dbState: () => 'disconnected' }).app).get('/')
        assert.match(res.text, /env-badge env-custom/)
        assert.match(res.text, /state-disconnected/)
    })
})

describe('security', () => {
    const evil = {
        name: '<script>alert(1)</script>',
        presenter: '"><img src=x onerror=alert(2)>',
        location: '</textarea><script>alert(4)</script>',
        notes: '</textarea><script>alert(5)</script>',
        pin: 'ABC23'
    }

    it('escapes data in every page that renders it (XSS)', async () => {
        const fb = [{ rating: { event: 1 }, notes: '<script>alert(6)</script>', name: '<b>x</b>' }]
        const { app } = makeApp({ events: fakeEvents([sampleEvent({ event: evil, feedback: fb })]) })
        for (const path of ['/?view=events', `/?view=event&id=${ID}`, `/?view=edit&id=${ID}`, `/?view=delete&id=${ID}`, '/?view=feedback&pin=ABC23']) {
            const res = await request(app).get(path)
            assert.doesNotMatch(res.text, /<script>alert/, path)
            assert.doesNotMatch(res.text, /<img src=x/, path)
            assert.doesNotMatch(res.text, /<b>x<\/b>/, path)
            assert.match(res.text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, path)
        }
    })

    it('escapes query-string values reflected into the page', async () => {
        const res = await request(withEvent().app).get('/?view=feedback&pin=%22%3E%3Cscript%3Ealert(7)%3C%2Fscript%3E')
        assert.doesNotMatch(res.text, /<script>alert\(7\)/)
        assert.match(res.text, /&#34;&gt;&lt;script&gt;/)
    })

    it('escapes POST results in the response panel', async () => {
        const { page } = await postAndFollow(makeApp().app, '/admin/events', { ...EVENT_FORM, name: '</pre><script>alert(3)</script>' })
        assert.doesNotMatch(page.text, /<script>alert\(3\)/)
    })

    it('sets security headers, including Referrer-Policy: same-origin', async () => {
        const res = await request(makeApp().app).get('/')
        // no-referrer would make browsers send "Origin: null" and break every form
        assert.equal(res.headers['referrer-policy'], 'same-origin')
        assert.match(res.headers['content-security-policy'], /default-src 'self'/)
        assert.equal(res.headers['x-content-type-options'], 'nosniff')
        assert.equal(res.headers['x-frame-options'], 'DENY')
        assert.equal(res.headers['x-powered-by'], undefined)
    })

    it('has no inline scripts or style attributes (CSP would block them)', async () => {
        const { app } = withEvent({ feedback: [{ rating: { event: 4 } }] })
        for (const path of ['/', '/?view=feedback&pin=ABC23', '/?view=events', `/?view=event&id=${ID}`, '/?view=create', `/?view=delete&id=${ID}`, '/?view=setup']) {
            const res = await request(app).get(path)
            assert.doesNotMatch(res.text, /<script(?![^>]*\bsrc=)[^>]*>/, path)
            assert.doesNotMatch(res.text, /\sstyle="|\son\w+="/, path)
        }
    })

    it('rejects cross-origin POSTs, including Origin: null', async () => {
        const { app, events } = withEvent()
        assert.equal((await request(app).post('/admin/setup/purge').set('Origin', 'https://evil.example.com')).status, 403)
        assert.equal((await request(app).post('/admin/events/delete').set('Origin', 'null').type('form').send({ id: ID })).status, 403)
        assert.equal((await request(app).post('/feedback').set('Referer', 'https://evil.example.com/x').type('form').send({ pin: 'ABC23', ...RATING_FORM })).status, 403)
        assert.equal(events.calls.length, 0)
    })

    it('accepts a same-origin POST', async () => {
        const res = await request(makeApp().app).post('/admin/setup/seed').set('Host', 'localhost:3000').set('Origin', 'http://localhost:3000')
        assert.equal(res.status, 303)
    })

    it('does not echo credentials from error messages', async () => {
        const events = fakeEvents()
        events.fail.list = Object.assign(new Error('failed to connect to mongodb://admin:hunter2@db.example.com:27017/x'), { name: 'MongoNetworkError' })
        const res = await request(makeApp({ events }).app).get('/?view=events')
        assert.equal(res.status, 503)
        assert.doesNotMatch(res.text, /hunter2/)
        assert.match(res.text, /mongodb:\/\/\*\*\*@db\.example\.com/)
    })

    it('ignores nested form keys (no qs object parsing)', async () => {
        const { app, events } = withEvent()
        await request(app).post('/feedback').type('form').send('pin[$ne]=x&event=5')
        assert.equal(events.calls[0][1], '')
    })

    it('returns 404 for unknown routes and serves static assets and the favicon', async () => {
        const { app } = makeApp()
        assert.equal((await request(app).get('/nope')).status, 404)
        const css = await request(app).get('/assets/styles.css')
        assert.equal(css.status, 200)
        assert.match(css.headers['content-type'], /text\/css/)
        assert.equal((await request(app).get('/favicon.ico')).status, 200)
    })
})
