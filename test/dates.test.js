const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { parseLocal, toDateInput, toTimeInput, formatWhen, defaultRange, rangeBounds } = require('../lib/dates')

describe('dates', () => {
    it('parses form dates and times as local time', () => {
        assert.deepEqual(parseLocal('2026-10-06', '14:30'), new Date(2026, 9, 6, 14, 30))
        assert.deepEqual(parseLocal('2026-10-06'), new Date(2026, 9, 6))
    })

    it('rejects impossible or malformed values', () => {
        for (const [d, t] of [['2026-02-30', '10:00'], ['2026-13-01', '10:00'], ['06/10/2026', '10:00'], ['2026-10-06', '24:00'], ['2026-10-06', '9:5'], [undefined, '10:00'], [{ $gt: '' }, '10:00']]) {
            assert.throws(() => parseLocal(d, t), { name: 'BadRequestError' }, `${d} ${t}`)
        }
    })

    it('round-trips through the input formats', () => {
        const d = new Date(2026, 0, 5, 7, 5)
        assert.equal(toDateInput(d), '2026-01-05')
        assert.equal(toTimeInput(d), '07:05')
        assert.deepEqual(parseLocal(toDateInput(d), toTimeInput(d)), d)
        assert.equal(toDateInput(null), '')
    })

    it('formats for display and tolerates bad values', () => {
        assert.match(formatWhen(new Date(2026, 9, 6, 14, 30)), /6 Oct 2026.*14:30/)
        assert.equal(formatWhen(null), '')
        assert.equal(formatWhen('garbage'), '')
    })

    it('defaults the list to this month and next, computed per call', () => {
        assert.deepEqual(defaultRange(new Date(2026, 9, 6)), { from: '2026-10-01', to: '2026-11-30' })
        assert.deepEqual(defaultRange(new Date(2026, 11, 31)), { from: '2026-12-01', to: '2027-01-31' })
    })

    it('makes an inclusive day range', () => {
        const { start, end } = rangeBounds('2026-10-01', '2026-10-31')
        assert.deepEqual(start, new Date(2026, 9, 1))
        assert.deepEqual(end, new Date(2026, 10, 1))
        assert.throws(() => rangeBounds('2026-10-02', '2026-10-01'), { name: 'BadRequestError' })
    })
})
