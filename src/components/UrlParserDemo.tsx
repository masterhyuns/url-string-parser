'use client';

import React, { useState } from 'react';
import { useUrlQueryParser } from '../index';
import { ParameterType } from '../types/parser.types';
import { encrypt, decrypt } from '../crypto/encryption';

// Mock 데이터 정의
const mockTypeAData: Record<string, string> = {
  'A_TYPE_1': 'A_TYPE_1_VALUE',
  'A_TYPE_2': 'A_TYPE_2_VALUE',
  'A_TYPE_3': 'A_TYPE_3_VALUE',
  'A_TYPE_4': 'A_TYPE_4_VALUE'
};

const mockTypeBData: Record<string, string> = {
  'B_TYPE_1': 'B_TYPE_1_VALUE',
  'B_TYPE_2': 'B_TYPE_2_VALUE',
  'B_TYPE_3': 'B_TYPE_3_VALUE',
  'B_TYPE_4': 'B_TYPE_4_VALUE'
};

// Mock 타입 변환기
const mockTypeConverter = async (value: string, type: ParameterType): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 100)); // 시뮬레이션 딜레이
  
  if (type === ParameterType.A) {
    if (mockTypeAData[value]) {
      return mockTypeAData[value];
    }
    throw new Error(`No conversion data for A type: ${value}`);
  }
  if (type === ParameterType.B) {
    if (mockTypeBData[value]) {
      return mockTypeBData[value];
    }
    throw new Error(`No conversion data for B type: ${value}`);
  }
  throw new Error(`Unknown type: ${type}`);
};

// 실제 암호화기
const realEncryptor = async (value: string): Promise<string> => {
  return await encrypt(value);
};

export const UrlParserDemo: React.FC = () => {
  const [inputUrl, setInputUrl] = useState('http://localhost/e{A_TYPE_1}?name={A_TYPE_2}&name2=e{B_TYPE_2}&name3=v{A_TYPE3}&name4={A_TYPE_6}');
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [decryptInput, setDecryptInput] = useState('');
  const [decryptResult, setDecryptResult] = useState('');
  const [encryptInput, setEncryptInput] = useState('');
  const [encryptResult, setEncryptResult] = useState('');
  
  const { parseResult, updateParseResult, getReconstructedUrl } = useUrlQueryParser(
    mockTypeConverter,
    realEncryptor
  );

  const handleParse = async () => {
    setIsLoading(true);
    try {
      await updateParseResult(inputUrl, true);
    } catch (error) {
      console.error('파싱 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExample = (exampleUrl: string) => {
    setInputUrl(exampleUrl);
  };

  const handleEncrypt = async () => {
    if (!encryptInput.trim()) return;
    try {
      const encrypted = await encrypt(encryptInput);
      setEncryptResult(encrypted);
    } catch {
      setEncryptResult('암호화 실패');
    }
  };

  const handleDecrypt = async () => {
    if (!decryptInput.trim()) return;
    try {
      const decrypted = await decrypt(decryptInput);
      setDecryptResult(decrypted);
    } catch {
      setDecryptResult('복호화 실패');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">URL & QueryString Parser 테스트</h1>
      
      {/* 입력 섹션 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">URL 입력</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            placeholder="URL을 입력하세요..."
          />
          <button
            onClick={handleParse}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
          >
            {isLoading ? '파싱 중...' : '파싱하기'}
          </button>
        </div>
        
        {/* 예제 버튼들 */}
        <div className="space-y-2">
          <p className="text-sm text-gray-700 font-medium mb-2">예제:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleExample('http://localhost/e{A_TYPE_1}?name={A_TYPE_2}&name2=e{B_TYPE_2}&name3=v{A_TYPE3}&name4={A_TYPE_6}')}
              className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-gray-800"
            >
              기본 예제
            </button>
            <button
              onClick={() => handleExample('custom://app/r{A_TYPE_1}?name=r{A_TYPE_2}')}
              className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-gray-800"
            >
              커스텀 프로토콜
            </button>
            <button
              onClick={() => handleExample('myapp://service/e{PROC=!@r{NAME}}?where=v{LITERAL}')}
              className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-gray-800"
            >
              중첩 구조
            </button>
            <button
              onClick={() => handleExample('http://test.com/path?er{name={A_TYPE_1}&type=B_TYPE_2}')}
              className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-gray-800"
            >
              전역 플래그
            </button>
          </div>
        </div>
      </div>

      {/* 암호화/복호화 도구 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">암호화/복호화 도구</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 암호화 */}
          <div>
            <h3 className="text-lg font-medium mb-2 text-gray-800">암호화</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={encryptInput}
                onChange={(e) => setEncryptInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="암호화할 텍스트를 입력하세요"
              />
              <button
                onClick={handleEncrypt}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                암호화하기
              </button>
              {encryptResult && (
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-600 mb-1">암호화 결과:</p>
                  <code className="text-xs text-gray-800 break-all">{encryptResult}</code>
                </div>
              )}
            </div>
          </div>

          {/* 복호화 */}
          <div>
            <h3 className="text-lg font-medium mb-2 text-gray-800">복호화</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={decryptInput}
                onChange={(e) => setDecryptInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="복호화할 암호화된 텍스트를 입력하세요"
              />
              <button
                onClick={handleDecrypt}
                className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                복호화하기
              </button>
              {decryptResult && (
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-600 mb-1">복호화 결과:</p>
                  <code className="text-xs text-gray-800 break-all">{decryptResult}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 결과 섹션 */}
      {parseResult.url.length > 0 || parseResult.query.length > 0 ? (
        <>
          {/* 변환된 URL */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">변환된 URL</h2>
            <div className="p-4 bg-gray-50 rounded-lg">
              <code className="text-sm break-all text-gray-900 font-medium">{getReconstructedUrl()}</code>
            </div>
          </div>

          {/* 상세 정보 토글 */}
          <div className="mb-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-500 hover:text-blue-600 font-medium"
            >
              {showDetails ? '상세 정보 숨기기' : '상세 정보 보기'} ▼
            </button>
          </div>

          {/* 상세 정보 */}
          {showDetails && (
            <>
              {/* URL 세그먼트 */}
              {parseResult.url.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">URL 세그먼트</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-2 text-gray-700 font-semibold">세그먼트</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">플래그</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">타입</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">추출값</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">변환값</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">암호화값</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">최종값</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.url.map((segment, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-mono text-gray-800">{segment.segment}</td>
                            <td className="p-2">
                              {segment.flags.encrypted && <span className="badge bg-red-100 text-red-700 px-2 py-1 rounded text-xs mr-1">E</span>}
                              {segment.flags.required && <span className="badge bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs mr-1">R</span>}
                              {segment.flags.literal && <span className="badge bg-green-100 text-green-700 px-2 py-1 rounded text-xs">V</span>}
                            </td>
                            <td className="p-2 text-gray-800">{segment.type}</td>
                            <td className="p-2 text-gray-800">{segment.extractedValue || '-'}</td>
                            <td className="p-2 text-gray-800">{segment.convertedValue || '-'}</td>
                            <td className="p-2 text-gray-800">{segment.encryptedValue || '-'}</td>
                            <td className="p-2 font-semibold text-gray-900">{segment.finalValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 쿼리 파라미터 */}
              {parseResult.query.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">쿼리 파라미터</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-2 text-gray-700 font-semibold">키</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">값</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">플래그</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">타입</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">추출값</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">변환값</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">암호화값</th>
                          <th className="text-left p-2 text-gray-700 font-semibold">최종값</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.query.map((query, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-mono text-gray-800">{query.key}</td>
                            <td className="p-2 font-mono text-gray-800">{query.value}</td>
                            <td className="p-2">
                              {query.flags.encrypted && <span className="badge bg-red-100 text-red-700 px-2 py-1 rounded text-xs mr-1">E</span>}
                              {query.flags.required && <span className="badge bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs mr-1">R</span>}
                              {query.flags.literal && <span className="badge bg-green-100 text-green-700 px-2 py-1 rounded text-xs">V</span>}
                            </td>
                            <td className="p-2 text-gray-800">{query.type}</td>
                            <td className="p-2 text-gray-800">{query.extractedValue || '-'}</td>
                            <td className="p-2 text-gray-800">{query.convertedValue || '-'}</td>
                            <td className="p-2 text-gray-800">{query.encryptedValue || '-'}</td>
                            <td className="p-2 font-semibold text-gray-900">{query.finalValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* JSON 결과 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">파싱 결과 (JSON)</h2>
                <pre className="p-4 bg-gray-50 rounded-lg overflow-x-auto text-xs text-gray-800">
                  {JSON.stringify(parseResult, null, 2)}
                </pre>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-700">
          URL을 입력하고 파싱하기 버튼을 클릭하세요.
        </div>
      )}
    </div>
  );
};