export abstract class SymmetricCryptoPort {
  abstract encrypt(plaintext: string): string;
  abstract decrypt(ciphertext: string): string;
}
