// server.js - TTS API 수정
const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const { createServer } = require('http');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');

// 환경 변수 로드
dotenv.config();

// Express 앱 초기화
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// API 키 검증
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.error('OpenAI API 키가 설정되지 않았습니다. .env 파일을 확인하세요.');
    process.exit(1);
}

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

// API 키 유효성 검증
async function validateApiKey() {
    try {
        // 간단한 API 호출로 유효성 검증
        await openai.models.list();
        console.log('OpenAI API 키가 유효합니다.');
        return true;
    } catch (error) {
        console.error('OpenAI API 키 검증 실패:', error.message);
        return false;
    }
}

// 서버 시작시 API 키 검증
validateApiKey();

// 임시 저장소
const documentStore = {
    embeddings: []
};

// 파일 업로드 설정
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB 제한
});

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// API 상태 확인 엔드포인트
app.get('/api/status', async (req, res) => {
    try {
        const isValid = await validateApiKey();
        if (isValid) {
            res.json({ status: 'ok', message: 'API 키가 유효합니다.' });
        } else {
            res.status(401).json({ status: 'error', message: 'API 키가 유효하지 않습니다.' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 채팅 API 엔드포인트
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, context, language } = req.body;
        
        console.log(`채팅 API 요청: "${message && message.substring(0, 50)}..."`);
        
        // 시스템 메시지 생성
        let systemMessage = '당신은 도움이 되는 AI 어시스턴트입니다. 항상 70자 이내로 짧고 간결하게 응답해 주세요. 친절하되 핵심만 답변하세요.';
        
        // 언어 설정에 따른 시스템 메시지 조정
        if (language && language !== 'en-US') {
            systemMessage += ` Please respond in ${getLanguageName(language)}.`;
        }
        
        // 컨텍스트 추가 (RAG)
        if (context && context.length > 0) {
            systemMessage += ' Use the following information to answer the question:\n\n';
            context.forEach(doc => {
                systemMessage += `Document: ${doc.name}\n${doc.content}\n\n`;
            });
            systemMessage += ' ';
        }
        
        // 메시지 배열 생성
        const messages = [
            { role: 'system', content: systemMessage }
        ];
        
        // 대화 기록 추가
        if (history && history.length > 0) {
            messages.push(...history);
        } else {
            messages.push({ role: 'user', content: message });
        }
        
        // OpenAI API 호출
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        });
        
        const responseContent = completion.choices[0].message.content;
        console.log(`채팅 API 응답 (처음 100자): "${responseContent.substring(0, 100)}..."`);
        
        // 응답 전송
        res.json({ 
            response: responseContent
        });
    } catch (error) {
        console.error('Chat API 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// TTS API 엔드포인트
app.post('/api/tts', async (req, res) => {
    try {
        const { text, language, voice, speed, style } = req.body;
        
        console.log(`TTS API 요청: "${text && text.substring(0, 50)}..."`);
        
        // 음성 설정 매핑
        const voiceMap = {
            'default': 'nova',
            'male': 'alloy',
            'female': 'nova',
            'neutral': 'echo'
        };
        
        const selectedVoice = voiceMap[voice] || 'nova';
        console.log(`선택된 TTS 음성: ${selectedVoice}, 속도: ${speed || 1.0}`);
        
        // OpenAI 음성 변환 API 호출
        const speechResponse = await openai.audio.speech.create({
            model: 'tts-1-hd', // OpenAI 최신 TTS 모델로 수정
            voice: selectedVoice,
            input: text,
            speed: speed || 1.0,
            response_format: 'mp3'
        });
        
        console.log('OpenAI TTS API 응답 성공');
        
        // 응답 스트림 변환
        const buffer = Buffer.from(await speechResponse.arrayBuffer());
        console.log(`생성된 오디오 크기: ${buffer.length} 바이트`);
        
        // 디버깅 목적으로 임시 저장 (선택 사항)
        // fs.writeFileSync('./debug-audio.mp3', buffer);
        
        // 응답 전송
        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Length', buffer.length);
        res.send(buffer);
    } catch (error) {
        console.error('TTS API 오류:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.response ? error.response.data : null
        });
    }
});

// 음성 인식 API 엔드포인트
app.post('/api/stt', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '오디오 파일이 필요합니다.' });
        }
        
        console.log(`STT API 요청: 파일 크기 ${req.file.size} 바이트`);
        
        // OpenAI 음성 인식 API 호출
        const transcription = await openai.audio.transcriptions.create({
            model: 'gpt-4o-transcribe', // OpenAI 최신 STT 모델로 수정
            file: req.file.buffer,
            language: req.body.language || 'ko'
        });
        
        console.log(`STT API 응답: "${transcription.text}"`);
        
        // 응답 전송
        res.json({ transcript: transcription.text });
    } catch (error) {
        console.error('STT API 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// RAG 임베딩 API 엔드포인트
app.post('/api/rag/embed', async (req, res) => {
    try {
        const { documents } = req.body;
        
        console.log(`RAG 임베딩 API 요청: ${documents.length}개 문서`);
        
        // 임베딩 생성
        const embeddings = await Promise.all(
            documents.map(async (doc) => {
                try {
                    // OpenAI 임베딩 API 호출
                    const embeddingResponse = await openai.embeddings.create({
                        model: 'text-embedding-ada-002',
                        input: doc.content
                    });
                    
                    return {
                        id: doc.id,
                        name: doc.name,
                        embedding: embeddingResponse.data[0].embedding,
                        content: doc.content
                    };
                } catch (error) {
                    console.error(`문서 ${doc.id} 임베딩 생성 오류:`, error);
                    
                    // 오류 발생 시 텍스트 토큰화로 대체
                    return {
                        id: doc.id,
                        name: doc.name,
                        tokens: tokenizeText(doc.content),
                        content: doc.content
                    };
                }
            })
        );
        
        // 임베딩 저장
        documentStore.embeddings = embeddings;
        
        // 응답 전송
        res.json({ embeddings: embeddings });
    } catch (error) {
        console.error('RAG 임베딩 API 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// RAG 검색 API 엔드포인트
app.post('/api/rag/search', async (req, res) => {
    try {
        const { query } = req.body;
        
        console.log(`RAG 검색 API 요청: "${query}"`);
        
        // 임베딩이 없으면 빈 배열 반환
        if (documentStore.embeddings.length === 0) {
            return res.json({ results: [] });
        }
        
        // 쿼리 임베딩 생성
        const queryEmbeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: query
        });
        
        const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
        
        // 문서와 쿼리 임베딩 간의 유사도 계산
        const results = documentStore.embeddings
            .filter(doc => doc.embedding) // 임베딩이 있는 문서만 필터링
            .map(doc => {
                // 코사인 유사도 계산
                const similarity = calculateCosineSimilarity(queryEmbedding, doc.embedding);
                
                return {
                    id: doc.id,
                    name: doc.name,
                    content: doc.content,
                    score: similarity
                };
            });
        
        // 유사도 점수로 정렬하고 상위 3개 반환
        const topResults = results
            .sort((a, b) => b.score - a.score)
            .filter(doc => doc.score > 0.7) // 임계값 이상만 포함
            .slice(0, 3);
        
        console.log(`RAG 검색 결과: ${topResults.length}개 문서 발견`);
        
        // 응답 전송
        res.json({ results: topResults });
    } catch (error) {
        console.error('RAG 검색 API 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

// 유틸리티 함수

// 언어 코드에서 언어 이름 가져오기
function getLanguageName(langCode) {
    const languageMap = {
        'ko-KR': 'Korean',
        'en-US': 'English',
        'ja-JP': 'Japanese',
        'zh-CN': 'Chinese',
        'es-ES': 'Spanish',
        'fr-FR': 'French',
        'de-DE': 'German',
        'ru-RU': 'Russian',
        'pt-BR': 'Portuguese',
        'it-IT': 'Italian'
    };
    
    return languageMap[langCode] || 'English';
}

// 텍스트 토큰화 (간단한 구현)
function tokenizeText(text) {
    // 소문자로 변환하고 특수 문자 제거
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
    
    // 공백으로 분할하여 토큰화
    return normalized.split(/\s+/).filter(token => token.length > 0);
}

// 코사인 유사도 계산
function calculateCosineSimilarity(vecA, vecB) {
    // 내적 계산
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }
    
    // 벡터 크기 계산
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    // 코사인 유사도 계산
    return dotProduct / (normA * normB);
}

// 서버 시작
httpServer.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`http://localhost:${PORT}에서 애플리케이션에 접속할 수 있습니다.`);
});