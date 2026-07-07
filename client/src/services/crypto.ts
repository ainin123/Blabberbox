import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

// tweetnacl-util API (confusing names, but correct):
// decodeUTF8(string) → Uint8Array   (string to bytes)
// encodeUTF8(Uint8Array) → string   (bytes to string)
// encodeBase64(Uint8Array) → string (bytes to base64)
// decodeBase64(string) → Uint8Array (base64 to bytes)

const { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } = naclUtil;

export const cryptoService = {
  generateKeyPair(): { publicKey: string; privateKey: string } {
    const kp = nacl.box.keyPair();
    return { publicKey: encodeBase64(kp.publicKey), privateKey: encodeBase64(kp.secretKey) };
  },

  encryptMessage(
    message: string,
    recipientPublicKey: string,
    senderPrivateKey: string
  ): { encryptedContent: string; nonce: string } {
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const msgBytes = decodeUTF8(message);
    const recipientPK = decodeBase64(recipientPublicKey);
    const senderSK = decodeBase64(senderPrivateKey);
    const encrypted = nacl.box(msgBytes, nonce, recipientPK, senderSK);
    return { encryptedContent: encodeBase64(encrypted), nonce: encodeBase64(nonce) };
  },

  decryptMessage(
    encryptedContent: string,
    nonce: string,
    senderPublicKey: string,
    recipientPrivateKey: string
  ): string | null {
    try {
      const ciphertext = decodeBase64(encryptedContent);
      const nonceBytes = decodeBase64(nonce);
      const senderPK = decodeBase64(senderPublicKey);
      const recipientSK = decodeBase64(recipientPrivateKey);
      const decrypted = nacl.box.open(ciphertext, nonceBytes, senderPK, recipientSK);
      if (!decrypted) return null;
      return encodeUTF8(decrypted);
    } catch {
      return null;
    }
  },

  encryptGroupMessage(
    message: string,
    groupKey: string
  ): { encryptedContent: string; nonce: string } {
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const msgBytes = decodeUTF8(message);
    const keyBytes = decodeBase64(groupKey);
    const encrypted = nacl.secretbox(msgBytes, nonce, keyBytes);
    return { encryptedContent: encodeBase64(encrypted), nonce: encodeBase64(nonce) };
  },

  decryptGroupMessage(
    encryptedContent: string,
    nonce: string,
    groupKey: string
  ): string | null {
    try {
      const ciphertext = decodeBase64(encryptedContent);
      const nonceBytes = decodeBase64(nonce);
      const keyBytes = decodeBase64(groupKey);
      const decrypted = nacl.secretbox.open(ciphertext, nonceBytes, keyBytes);
      if (!decrypted) return null;
      return encodeUTF8(decrypted);
    } catch {
      return null;
    }
  },

  generateGroupKey(): string {
    return encodeBase64(nacl.randomBytes(nacl.secretbox.keyLength));
  },
};
