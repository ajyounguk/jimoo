// Date helpers. Form dates and times are in the server's local time zone,
// as they were in v1; values are built with the Date(y, m, d, h, min)
// constructor rather than by parsing strings, which is engine-dependent.

const { BadRequestError } = require('./errors')

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

const pad = n => String(n).padStart(2, '0')

// 'YYYY-MM-DD' (+ optional 'HH:MM') -> Date, or throw BadRequestError
function parseLocal(date, time = '00:00', label = 'date') {
    const d = DATE_RE.exec(typeof date === 'string' ? date : '')
    const t = TIME_RE.exec(typeof time === 'string' ? time : '')
    if (!d) throw new BadRequestError(`${label} must be a date (YYYY-MM-DD)`)
    if (!t) throw new BadRequestError(`${label} time must be HH:MM`)
    const [y, m, day] = [Number(d[1]), Number(d[2]), Number(d[3])]
    const out = new Date(y, m - 1, day, Number(t[1]), Number(t[2]))
    if (out.getFullYear() !== y || out.getMonth() !== m - 1 || out.getDate() !== day) {
        throw new BadRequestError(`${label} '${date}' is not a real date`)
    }
    return out
}

// Date -> 'YYYY-MM-DD' / 'HH:MM' for <input type=date|time>
function toDateInput(d) {
    return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : ''
}
function toTimeInput(d) {
    return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : ''
}

// Human-readable, e.g. "Tue 6 Oct 2026, 14:30"
function formatWhen(d) {
    if (!d) return ''
    const date = d instanceof Date ? d : new Date(d)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

// Default event-list range: first day of this month to the last day of next
function defaultRange(now = new Date()) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    return { from: toDateInput(from), to: toDateInput(to) }
}

// Inclusive day range -> [start of from, start of the day after to)
function rangeBounds(from, to) {
    const start = parseLocal(from, '00:00', 'from')
    const last = parseLocal(to, '00:00', 'to')
    if (last < start) throw new BadRequestError('to must not be before from')
    const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
    return { start, end }
}

module.exports = { parseLocal, toDateInput, toTimeInput, formatWhen, defaultRange, rangeBounds }
