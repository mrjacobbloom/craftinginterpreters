/// <reference path="../interfaces.d.ts" />
import { expect } from 'chai';
import { it, describe } from '../../mochita';
import { Table } from '../Table';
import { numberValue } from '../value';
describe('Test suite for Table', async () => {
    await describe('#get', async () => {
        await it('If value is in table, returns that value', async () => {
            const table = new Table();
            table.set('foo', numberValue(1));
            table.set('bar', numberValue(2));
            table.set('baz', numberValue(3));
            expect(table.get('foo')).to.deep.equal(numberValue(1));
            expect(table.get('bar')).to.deep.equal(numberValue(2));
            expect(table.get('baz')).to.deep.equal(numberValue(3));
        });
        await it('If value is not in table, returns null', async () => {
            const table = new Table();
            expect(table.get('foo')).to.equal(null);
        });
    });
    await describe('#set', async () => {
        await it('If there is not an entry for this key, value is stored correctly', async () => {
            const table = new Table();
            table.set('foo', numberValue(1));
            expect(table.get('foo')).to.deep.equal(numberValue(1));
        });
        await it('If there is an entry for this key, new value replaces the old value', async () => {
            const table = new Table();
            table.set('foo', numberValue(1));
            table.set('foo', numberValue(2));
            expect(table.get('foo')).to.deep.equal(numberValue(2));
        });
    });
    await describe('#delete', async () => {
    });
    await it('Stress test 1', async () => {
        const table = new Table();
        // Fill with (keyX -> X) for X = { 0 .. 99 }
        for (let i = 0; i < 100; i++) {
            table.set(`key${i}`, numberValue(i));
        }
        // Test that (keyX -> X) for X = { 0 .. 99 }
        for (let i = 0; i < 100; i++) {
            expect(table.get(`key${i}`)).to.deep.equal(numberValue(i));
        }
        // Fill with (keyX -> 2*X) for X = { 0 .. 99 }
        for (let i = 0; i < 100; i++) {
            table.set(`key${i}`, numberValue(i * 2));
        }
        // Test that (keyX -> 2*X) for X = { 0 .. 99 }
        for (let i = 0; i < 100; i++) {
            expect(table.get(`key${i}`)).to.deep.equal(numberValue(i * 2));
        }
        // Delete keyX for X = { 0 .. 49 }
        for (let i = 0; i < 50; i++) {
            table.delete(`key${i}`);
        }
        // Test that (keyX -> null) for X = { 0 .. 49 }
        for (let i = 0; i < 50; i++) {
            expect(table.get(`key${i}`)).to.equal(null);
        }
        // Fill with (keyX -> 2*X) for X = { 100 .. 124 }
        for (let i = 100; i < 125; i++) {
            table.set(`key${i}`, numberValue(i * 2));
        }
        // Test that (keyX -> 2*X) for X = { 50 .. 124 }
        for (let i = 50; i < 125; i++) {
            expect(table.get(`key${i}`)).to.deep.equal(numberValue(i * 2));
        }
    });
});
