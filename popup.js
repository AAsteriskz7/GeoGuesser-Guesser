// Run immediately when popup opens
document.addEventListener('DOMContentLoaded', async () => {
    const resultDiv = document.getElementById('result');
    const setupDiv = document.getElementById('setup');
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');
    const copyButton = document.getElementById('copyButton');

    // First, check if the API key is set
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
        if (!result.geminiApiKey) {
            // Show setup interface if no API key is found
            resultDiv.textContent = "Please set up your Gemini API key to use this extension.";
            setupDiv.style.display = 'block';
            
            // Load saved API key if it exists
            if (result.geminiApiKey) {
                apiKeyInput.value = result.geminiApiKey;
            }
            
            // Set up save button listener
            saveButton.addEventListener('click', () => {
                const apiKey = apiKeyInput.value.trim();
                
                if (!apiKey) {
                    showStatus('Please enter a valid API key', 'error');
                    return;
                }
                
                chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
                    showStatus('API key saved! Refreshing...', 'success');
                    
                    // Reload popup after saving
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                });
            });
        } else {
            // If API key exists, proceed with screenshot and API call
            captureAndProcessScreenshot(result.geminiApiKey, resultDiv, copyButton);
        }
    });
});

function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

async function captureAndProcessScreenshot(apiKey, resultDiv, copyButton) {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, async (dataUrl) => {
        if (chrome.runtime.lastError) {
            resultDiv.textContent = "Error capturing screenshot: " + chrome.runtime.lastError.message;
            copyButton.style.display = 'none';
            return;
        }

        resultDiv.textContent = "Sending screenshot to Gemini API...";
        copyButton.style.display = 'none';
        const base64Image = dataUrl.replace(/^data:image\/png;base64,/, '');

        const requestBody = {
            contents: [{
                parts: [
                    {
                        text: "Guess the location from only this photo. Use context clues to figure it out. If you know the exact place provide that, otherwise take your best educated guess and ONLY return the city, country, continent. Response should be formatted as [Place name]*, [City], [Country], [Continent]"
                    },
                    {
                        inline_data: {
                            mime_type: "image/png",
                            data: base64Image
                        }
                    }
                ]
            }]
        };

        try {
            const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!apiResponse.ok) {
                const errorData = await apiResponse.json();
                throw new Error(`HTTP error ${apiResponse.status}: ${errorData.error?.message || apiResponse.statusText}`);
            }

            const data = await apiResponse.json();
            
            // Improved response parsing
            let locationText = "Could not extract location.";
            if (data.candidates && data.candidates.length > 0 &&
                data.candidates[0].content && data.candidates[0].content.parts &&
                data.candidates[0].content.parts.length > 0 && data.candidates[0].content.parts[0].text) {
                locationText = data.candidates[0].content.parts[0].text;
                resultDiv.textContent = "Location: " + locationText;
                copyButton.style.display = 'inline-block'; // Show copy button
                copyButton.onclick = () => {
                    navigator.clipboard.writeText(locationText)
                        .then(() => showStatus('Location copied to clipboard!', 'success'))
                        .catch(err => showStatus('Failed to copy: ' + err, 'error'));
                };
            } else {
                resultDiv.textContent = "Location: " + locationText;
                if (data.promptFeedback && data.promptFeedback.blockReason){
                    resultDiv.textContent += ` (Blocked: ${data.promptFeedback.blockReason})`;
                } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason) {
                    resultDiv.textContent += ` (Finish reason: ${data.candidates[0].finishReason})`;
                }
            }

        } catch (error) {
            resultDiv.textContent = "Error calling Gemini API: " + error.message;
            copyButton.style.display = 'none';
        }
    });
}