// CHAPTER 1: INTRODUCTION, CHALLENGE 3
/*
 * PROMPT:
 * To get some practice with pointers, define a doubly linked list of
 * heap-allocated strings. Write functions to insert, find, and delete items
 * from it. Test them.
 */
import { expect } from 'chai';
import { describe, it } from '../mochita';
class LinkedList {
    head = null;
    insert(value) {
        if (!this.head) {
            this.head = {
                prev: null,
                next: null,
                value,
            };
        }
        else {
            let prev = this.head;
            while (prev.next)
                prev = prev.next;
            const newNode = {
                prev,
                next: null,
                value,
            };
            prev.next = newNode;
        }
    }
    includes(value) {
        let current = this.head;
        if (!current)
            return false;
        do {
            if (current.value === value)
                return true;
            current = current.next;
        } while (current?.next);
        return false;
    }
}
describe('LinkedList AA', async () => {
    await it('Head is null by default', () => {
        const ll = new LinkedList;
        expect(ll).to.have.property('head');
        expect(ll.head).to.equal(null);
    });
    await describe('insert', async () => {
        await it('If list is empty, inserts at list.head and prev/next = null', () => {
            const ll = new LinkedList;
            ll.insert('foo');
            expect(ll.head).to.be.an('object');
            expect(ll.head?.value).to.equal('foo');
            expect(ll.head?.prev).to.equal(null);
            expect(ll.head?.next).to.equal(null);
        });
        await it('If list is not empty, inserts at end and sets next/prev appropriately', () => {
            const ll = new LinkedList;
            ll.insert('foo');
            ll.insert('bar');
            expect(ll.head).to.be.an('object');
            expect(ll.head?.value).to.equal('foo');
            expect(ll.head?.prev).to.equal(null);
            expect(ll.head?.next).to.be.an('object');
            expect(ll.head?.next?.value).to.equal('bar');
            expect(ll.head?.next?.prev).to.equal(ll.head);
            expect(ll.head?.next?.next).to.equal(null);
        });
    });
    await describe('includes', async () => {
        await it('If list is empty, returns false', () => {
            const ll = new LinkedList;
            expect(ll.includes('foo')).to.equal(false);
        });
        await it('If list contains the value, returns true', () => {
            const ll = new LinkedList;
            ll.insert('foo');
            expect(ll.includes('foo')).to.equal(true);
        });
        await it('If list contains nodes but not the given value, returns false', () => {
            const ll = new LinkedList;
            ll.insert('foo');
            expect(ll.includes('bar')).to.equal(false);
        });
    });
});
