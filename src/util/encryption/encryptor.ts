import crypto from 'crypto'
const secretKey = process.env.SECRET_KEY as string // Must be 256 bits (32 characters)
const ivLength = 16 // For AES, this is always 16
const bufferEncoding: BufferEncoding = "base64"
const algorithm = 'aes-256-cbc'

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString(bufferEncoding) + ':' + encrypted.toString(bufferEncoding);
}

export function decrypt(text: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() as string, bufferEncoding);
    const encryptedText = Buffer.from(textParts.join(':'), bufferEncoding);
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}