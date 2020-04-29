import { v4 as uuid } from 'uuid';
import { assert } from 'chai';
import { decrypt, encrypt } from '../../src/util/encryption/encryptor';

describe("Should encrypt and decrypt", () => {
    const thing = uuid()
    const encrypted = encrypt(thing)
    const result = decrypt(encrypted)
    assert.equal(result, thing)
})