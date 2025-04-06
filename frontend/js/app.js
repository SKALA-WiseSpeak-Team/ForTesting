// 애플리케이션의 메인 진입점
document.addEventListener('DOMContentLoaded', () => {
    // 모든 모듈 초기화
    SettingsManager.init();
    SpeechRecognitionModule.init();
    TextToSpeechModule.init();
    ChatService.init();
    RAGService.init();
    
    // UI 요소
    const micBtn = document.getElementById('mic-btn');
    const stopBtn = document.getElementById('stop-btn');
    const statusIndicator = document.getElementById('status-indicator');
    const chatMessages = document.getElementById('chat-messages');
    const continuousModeToggle = document.getElementById('continuous-mode-toggle');
    const continuousModeStatus = document.getElementById('continuous-mode-status');
    
    // 이벤트 리스너
    micBtn.addEventListener('click', toggleListening);
    stopBtn.addEventListener('click', stopListening);
    
    // 연속 모드 토글 이벤트 리스너 확인 및 설정
    if (continuousModeToggle) {
        console.log('연속 모드 토글 요소 발견');
        continuousModeToggle.addEventListener('change', function() {
            console.log('연속 모드 토글 클릭됨, 새 상태:', this.checked);
            toggleContinuousMode(this.checked);
        });
    } else {
        console.error('연속 모드 토글 요소를 찾을 수 없습니다.');
    }
    
    // 오디오 상태 처리
    let isListening = false;
    let isSpeaking = false;
    let processingInput = false;
    
    // 대화 기록
    let conversationHistory = [];
    
    // 초기 연속 모드 상태 설정
    let continuousMode = SettingsManager.getSetting('continuousMode') || false;
    console.log('초기 연속 모드 상태:', continuousMode);
    updateContinuousModeUI();
    
    // 음성 인식 모듈 콜백 설정
    SpeechRecognitionModule.onResult(handleSpeechResult);
    SpeechRecognitionModule.onError(handleSpeechError);
    SpeechRecognitionModule.onEnd(handleSpeechEnd);
    
    // 음성 인식 토글
    function toggleListening() {
        const state = SpeechRecognitionModule.getRecognitionState();
        console.log('토글 리스닝 - 현재 상태:', state);
        
        if (state.isRecognizing) {
            stopListening();
        } else {
            startListening();
        }
    }
    
    // 음성 인식 시작
    function startListening() {
        if (isSpeaking || processingInput) {
            console.log('음성 출력 중이거나 처리 중이므로 대기');
            // 음성 출력 중이거나 처리 중이면 대기
            return;
        }
        
        isListening = true;
        updateUIState('listening');
        
        SpeechRecognitionModule.start();
    }
    
    // 음성 인식 중지
    function stopListening() {
        // 현재 인식된 텍스트 가져오기
        const currentText = SpeechRecognitionModule.getCurrentTranscript();
        
        // 음성 인식 중지
        SpeechRecognitionModule.stop();
        isListening = false;
        
        // 연속 모드가 아니고 인식된 텍스트가 있으면 처리
        if (!continuousMode && currentText && currentText.trim() !== '') {
            console.log('정지 버튼으로 인식 종료, 처리 중인 텍스트:', currentText);
            updateUIState('processing');
            addMessage(currentText, 'user');
            processUserInput(currentText);
        } else {
            updateUIState('idle');
        }
    }
    
    // 연속 모드 토글 (명시적 값 설정 가능)
    function toggleContinuousMode(explicitValue = null) {
        // 명시적인 값이 전달되면 그 값을 사용, 그렇지 않으면 토글
        if (explicitValue !== null) {
            continuousMode = explicitValue;
            console.log('연속 모드 명시적 설정:', continuousMode);
        } else {
            continuousMode = SpeechRecognitionModule.toggleContinuousMode();
            console.log('연속 모드 토글됨:', continuousMode);
        }
        
        // 설정 업데이트
        SettingsManager.updateSetting('continuousMode', continuousMode);
        
        // UI 업데이트
        updateContinuousModeUI();
        
        // 모드 전환 메시지 표시
        const message = continuousMode 
            ? '연속 음성 인식 모드가 활성화되었습니다. 계속 말씀하세요.'
            : '연속 음성 인식 모드가 비활성화되었습니다.';
        
        addMessage(message, 'system');
        
        // 연속 모드가 켜졌고 현재 리스닝 중이 아니면 시작
        if (continuousMode && !isListening && !isSpeaking && !processingInput) {
            setTimeout(startListening, 500);
        }
    }
    
    // 연속 모드 UI 업데이트
    function updateContinuousModeUI() {
        if (continuousModeToggle) {
            continuousModeToggle.checked = continuousMode;
        }
        
        if (continuousModeStatus) {
            continuousModeStatus.textContent = continuousMode ? '활성화' : '비활성화';
            continuousModeStatus.style.color = continuousMode ? '#34a853' : '#666';
        }
    }
    
    // 음성 인식 결과 처리
    function handleSpeechResult(transcript) {
        console.log('음성 인식 결과 수신:', transcript);
        
        if (transcript.trim() === '' || processingInput) {
            console.log('빈 텍스트이거나 이미 처리 중이므로 무시');
            return;
        }
        
        // 처리 중 상태로 설정
        processingInput = true;
        updateUIState('processing');
        
        addMessage(transcript, 'user');
        processUserInput(transcript);
    }
    
    // 음성 인식 오류 처리
    function handleSpeechError(error) {
        console.error('음성 인식 오류:', error);
        updateUIState('error', '음성 인식 오류');
        isListening = SpeechRecognitionModule.getRecognitionState().isRecognizing;
    }
    
    // 음성 인식 종료 처리
    function handleSpeechEnd() {
        isListening = SpeechRecognitionModule.getRecognitionState().isRecognizing;
        console.log('음성 인식 종료 처리, 현재 상태:', { isListening, isSpeaking, processingInput });
        
        if (!isListening && !isSpeaking && !processingInput) {
            updateUIState('idle');
        }
    }
    
    // 사용자 입력 처리
    async function processUserInput(text) {
        // 대화 기록에 사용자 메시지 추가
        conversationHistory.push({ role: 'user', content: text });
        
        try {
            // RAG가 활성화되어 있는지 확인
            const ragEnabled = SettingsManager.getSetting('ragEnabled');
            
            let response;
            if (ragEnabled) {
                // RAG 기반 응답 생성
                const documents = await RAGService.getRelevantDocuments(text);
                response = await ChatService.getResponseWithContext(text, conversationHistory, documents);
            } else {
                // 일반 응답 생성
                response = await ChatService.getResponse(text, conversationHistory);
            }
            
            // 대화 기록에 AI 응답 추가
            conversationHistory.push({ role: 'assistant', content: response });
            
            // UI에 메시지 추가
            addMessage(response, 'bot');
            
            // 음성으로 응답 재생
            await speakResponse(response);
            
            // 처리 완료 후 상태 업데이트
            processingInput = false;
            
            // 연속 모드이면 다시 리스닝 상태로
            if (continuousMode) {
                updateUIState('listening');
                // 짧은 딜레이 후 다시 시작
                setTimeout(() => {
                    if (continuousMode && !isListening && !isSpeaking) {
                        startListening();
                    }
                }, 500);
            } else {
                updateUIState('idle');
            }
        } catch (error) {
            console.error('응답 처리 오류:', error);
            addMessage('죄송합니다. 응답을 생성하는데 문제가 발생했습니다.', 'bot');
            
            // 처리 완료 후 상태 업데이트
            processingInput = false;
            updateUIState('error', '응답 생성 오류');
            
            // 3초 후 다시 리스닝 또는 대기 상태로
            setTimeout(() => {
                if (continuousMode) {
                    updateUIState('listening');
                    startListening();
                } else {
                    updateUIState('idle');
                }
            }, 3000);
        }
    }
    
    // AI 응답을 음성으로 재생
    async function speakResponse(text) {
        isSpeaking = true;
        updateUIState('speaking');
        
        try {
            // TTS 설정 가져오기
            const voice = SettingsManager.getSetting('voice');
            const speed = SettingsManager.getSetting('speed');
            const pitch = SettingsManager.getSetting('pitch');
            const style = SettingsManager.getSetting('style');
            
            await TextToSpeechModule.speak(text, { voice, speed, pitch, style });
            
            isSpeaking = false;
            
            // 연속 모드에 따라 상태 업데이트
            if (continuousMode) {
                updateUIState('listening');
                // 짧은 딜레이 후 다시 시작
                setTimeout(() => {
                    if (continuousMode && !isListening && !isSpeaking && !processingInput) {
                        startListening();
                    }
                }, 500);
            } else {
                updateUIState('idle');
            }
        } catch (error) {
            console.error('TTS 오류:', error);
            isSpeaking = false;
            updateUIState('error', 'TTS 오류');
            
            // 3초 후 다시 리스닝 또는 대기 상태로
            setTimeout(() => {
                if (continuousMode) {
                    updateUIState('listening');
                    startListening();
                } else {
                    updateUIState('idle');
                }
            }, 3000);
        }
    }
    
    // UI에 메시지 추가
    function addMessage(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        
        if (sender === 'user') {
            messageElement.classList.add('user-message');
        } else if (sender === 'bot') {
            messageElement.classList.add('bot-message');
        } else {
            messageElement.classList.add('system-message');
        }
        
        messageElement.textContent = text;
        
        chatMessages.appendChild(messageElement);
        
        // 스크롤을 최신 메시지로 이동
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // UI 상태 업데이트
    function updateUIState(state, message = '') {
        console.log('UI 상태 업데이트:', state, message);
        
        // 마이크 버튼 상태 업데이트
        micBtn.classList.toggle('listening', state === 'listening');
        micBtn.disabled = state === 'speaking' || state === 'processing';
        
        // 중지 버튼 표시/숨김
        stopBtn.classList.toggle('hidden', state !== 'listening');
        
        // 상태 표시
        switch (state) {
            case 'idle':
                statusIndicator.textContent = '준비됨';
                statusIndicator.style.color = '#666';
                break;
            case 'listening':
                statusIndicator.textContent = '듣는 중...';
                statusIndicator.style.color = '#4285f4';
                break;
            case 'processing':
                statusIndicator.textContent = '처리 중...';
                statusIndicator.style.color = '#fbbc05';
                break;
            case 'speaking':
                statusIndicator.textContent = '말하는 중...';
                statusIndicator.style.color = '#34a853';
                break;
            case 'error':
                statusIndicator.textContent = message || '오류 발생';
                statusIndicator.style.color = '#ea4335';
                break;
        }
    }
    
    // 초기 상태 설정
    if (continuousMode) {
        // 자동으로 연속 모드 시작
        console.log('연속 모드 활성화됨: 자동 시작');
        setTimeout(() => {
            startListening();
            addMessage('연속 음성 인식 모드가 활성화되었습니다. 계속 말씀하세요.', 'system');
        }, 1000);
    }
});