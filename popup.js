// Run immediately when popup opens
document.addEventListener('DOMContentLoaded', async () => {
    const resultDiv = document.getElementById('result');
    
    // Capture the screenshot of the current tab
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, async (dataUrl) => {
        if (chrome.runtime.lastError) {
            resultDiv.textContent = "Error capturing screenshot: " + chrome.runtime.lastError.message;
            return;
        }

        resultDiv.textContent = "Sending screenshot to Gemini API...";

        // The dataUrl is already in base64 format, just need to remove the prefix
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
            const apiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR API HERE', {
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
            resultDiv.textContent = "Location: " + data.candidates[0].content.parts[0].text;
        } catch (error) {
            resultDiv.textContent = "Error calling Gemini API: " + error.message;
        }
    });
});