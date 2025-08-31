const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureUserInputExamples() {
    console.log('Capturing user input display examples...');
    
    // Create screenshots directory
    const screenshotsDir = path.join(__dirname, '.playwright-mcp');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
    });
    
    const context = await browser.newContext({
        viewport: { width: 1400, height: 900 }
    });
    
    const page = await context.newPage();
    
    try {
        console.log('1. Navigating to application...');
        await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        // Navigate to Sessions
        console.log('2. Clicking Sessions tab...');
        const sessionsTab = page.locator('button[role="tab"][aria-controls="content-sessions"]').first();
        await sessionsTab.click();
        await page.waitForTimeout(3000);
        
        // Click on first session
        console.log('3. Opening first session...');
        const sessionCards = await page.locator('.session-card').all();
        if (sessionCards.length > 0) {
            await sessionCards[0].click();
            await page.waitForTimeout(5000);
            
            // Take overview screenshot
            await page.screenshot({
                path: path.join(screenshotsDir, 'user-input-session-overview.png'),
                fullPage: true
            });
            
            // Scroll through and capture user input examples
            console.log('4. Capturing user message examples...');
            
            const userMessages = await page.locator('session-detail').locator('message-card.user').all();
            console.log(`Found ${userMessages.length} user messages`);
            
            let capturedCount = 0;
            for (let i = 0; i < Math.min(userMessages.length, 5); i++) {
                try {
                    const userMessage = userMessages[i];
                    
                    // Scroll message into view
                    await userMessage.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(1000);
                    
                    // Get message text for context
                    const messageText = await userMessage.textContent();
                    console.log(`   User message ${i + 1}: "${messageText?.substring(0, 80) || 'No text'}..."`);
                    
                    // Get bounding box and capture focused screenshot
                    const boundingBox = await userMessage.boundingBox();
                    if (boundingBox) {
                        await page.screenshot({
                            path: path.join(screenshotsDir, `user-input-example-${capturedCount + 1}.png`),
                            clip: {
                                x: Math.max(0, boundingBox.x - 50),
                                y: Math.max(0, boundingBox.y - 30),
                                width: Math.min(1300, boundingBox.width + 100),
                                height: Math.min(600, boundingBox.height + 60)
                            }
                        });
                        capturedCount++;
                        console.log(`     ✓ Captured user input example ${capturedCount}`);
                    }
                } catch (e) {
                    console.log(`   Error capturing user message ${i + 1}: ${e.message}`);
                }
            }
            
            // Test different sessions for variety
            console.log('5. Testing different sessions...');
            
            // Go back to sessions list
            await page.goBack();
            await page.waitForTimeout(2000);
            
            // Try a different session
            const allSessionCards = await page.locator('.session-card').all();
            if (allSessionCards.length > 1) {
                console.log('   Opening second session...');
                await allSessionCards[1].click();
                await page.waitForTimeout(3000);
                
                // Capture one example from second session
                const secondSessionUserMessages = await page.locator('session-detail').locator('message-card.user').all();
                if (secondSessionUserMessages.length > 0) {
                    await secondSessionUserMessages[0].scrollIntoViewIfNeeded();
                    await page.waitForTimeout(1000);
                    
                    const secondSessionText = await secondSessionUserMessages[0].textContent();
                    console.log(`   Second session user message: "${secondSessionText?.substring(0, 80) || 'No text'}..."`);
                    
                    const secondBoundingBox = await secondSessionUserMessages[0].boundingBox();
                    if (secondBoundingBox) {
                        await page.screenshot({
                            path: path.join(screenshotsDir, 'user-input-second-session.png'),
                            clip: {
                                x: Math.max(0, secondBoundingBox.x - 50),
                                y: Math.max(0, secondBoundingBox.y - 30),
                                width: Math.min(1300, secondBoundingBox.width + 100),
                                height: Math.min(600, secondBoundingBox.height + 60)
                            }
                        });
                        console.log('     ✓ Captured second session user input example');
                    }
                }
            }
            
            // Final comprehensive view
            await page.screenshot({
                path: path.join(screenshotsDir, 'user-input-testing-complete.png'),
                fullPage: true
            });
            
            console.log(`✓ Successfully captured ${capturedCount} user input examples`);
            
        } else {
            console.log('! No session cards found');
        }
        
    } catch (error) {
        console.error('Error during capture:', error);
        await page.screenshot({
            path: path.join(screenshotsDir, 'capture-error.png'),
            fullPage: true
        });
    } finally {
        await browser.close();
    }
    
    console.log('✓ User input example capture completed');
}

// Run the capture
captureUserInputExamples().catch(console.error);