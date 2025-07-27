// 간단한 AES-GCM 기반 양방향 암호화 모듈
// 브라우저 환경에서 Web Crypto API 사용

class SimpleEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  
  // 고정된 키 (실제 운영에서는 안전한 키 관리 필요)
  private static readonly FIXED_KEY = new Uint8Array([
    0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6,
    0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c,
    0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6,
    0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c
  ]);

  private static async getCryptoKey(): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      this.FIXED_KEY,
      { name: this.ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // 암호화
  static async encrypt(text: string): Promise<string> {
    try {
      const key = await this.getCryptoKey();
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      const encoder = new TextEncoder();
      const data = encoder.encode(text);

      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        data
      );

      // IV + 암호화된 데이터를 Base64로 인코딩
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('암호화에 실패했습니다.');
    }
  }

  // 복호화
  static async decrypt(encryptedText: string): Promise<string> {
    try {
      const key = await this.getCryptoKey();
      
      // Base64 디코딩
      const combined = new Uint8Array(
        atob(encryptedText)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      // IV와 암호화된 데이터 분리
      const iv = combined.slice(0, this.IV_LENGTH);
      const encryptedData = combined.slice(this.IV_LENGTH);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('복호화에 실패했습니다.');
    }
  }
}

// 편의 함수들
export const encrypt = (text: string): Promise<string> => {
  return SimpleEncryption.encrypt(text);
};

export const decrypt = (encryptedText: string): Promise<string> => {
  return SimpleEncryption.decrypt(encryptedText);
};

// 암호화 테스트 함수
export const testEncryption = async (text: string): Promise<{ encrypted: string; decrypted: string }> => {
  const encrypted = await encrypt(text);
  const decrypted = await decrypt(encrypted);
  return { encrypted, decrypted };
};