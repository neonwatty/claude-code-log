const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function finalUserInputTest() {
    console.log('Final comprehensive user input display test...');
    
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
        console.log('2. Navigating to Sessions...');
        const sessionsTab = page.locator('button[role="tab"][aria-controls="content-sessions"]').first();
        await sessionsTab.click();
        await page.waitForTimeout(3000);
        
        // Click on first session
        console.log('3. Opening session detail...');
        const sessionCards = await page.locator('.session-card').all();
        if (sessionCards.length > 0) {
            await sessionCards[0].click();
            await page.waitForTimeout(5000);
            
            // Take full session detail screenshot
            await page.screenshot({
                path: path.join(screenshotsDir, 'final-session-detail-full.png'),
                fullPage: true
            });
            
            // Check for message cards using different selectors
            console.log('4. Analyzing message display...');
            
            const allMessageCards = await page.locator('session-detail message-card').all();
            console.log(`   Total message cards: ${allMessageCards.length}`);
            
            // Check for user messages using multiple strategies
            const userStrategies = [
                'session-detail message-card:has-text("User")',
                'session-detail message-card:has-text("🤷")',
                'session-detail .message-card.user',
                'session-detail message-card[role="user"]'
            ];
            
            let userMessageElements = [];
            for (const strategy of userStrategies) {
                const elements = await page.locator(strategy).all();
                if (elements.length > 0) {
                    console.log(`   Found ${elements.length} user messages with strategy: ${strategy}`);
                    userMessageElements = elements;
                    break;
                }
            }
            
            if (userMessageElements.length === 0) {
                // Try JavaScript evaluation to find user messages
                const jsResult = await page.evaluate(() => {
                    const sessionDetail = document.querySelector('session-detail');
                    if (!sessionDetail || !sessionDetail.shadowRoot) return { error: 'No session detail shadow root' };
                    
                    const messageCards = sessionDetail.shadowRoot.querySelectorAll('message-card');
                    const userMessages = [];
                    const allMessages = [];
                    
                    messageCards.forEach((card, index) => {
                        const text = card.textContent || '';
                        const classes = card.className || '';
                        
                        allMessages.push({
                            index,
                            hasUserText: text.includes('User') || text.includes('🤷'),
                            hasUserClass: classes.includes('user'),
                            textPreview: text.substring(0, 100)
                        });
                        
                        if (text.includes('User') || text.includes('🤷') || classes.includes('user')) {
                            userMessages.push({
                                index,
                                textPreview: text.substring(0, 200),
                                classes
                            });
                        }
                    });
                    
                    return {
                        totalMessages: messageCards.length,
                        userMessages: userMessages,
                        sampleMessages: allMessages.slice(0, 5)
                    };
                });
                
                console.log('   JavaScript analysis results:');
                console.log(`     Total messages: ${jsResult.totalMessages}`);
                console.log(`     User messages found: ${jsResult.userMessages?.length || 0}`);
                
                if (jsResult.userMessages && jsResult.userMessages.length > 0) {
                    console.log('   User message examples:');
                    jsResult.userMessages.slice(0, 3).forEach((msg, i) => {
                        console.log(`     ${i + 1}. "${msg.textPreview}..."`);
                    });
                }
                
                console.log('   Sample of all messages:');
                jsResult.sampleMessages?.forEach((msg, i) => {
                    console.log(`     ${i + 1}. User?: ${msg.hasUserText} | "${msg.textPreview}..."`);
                });
            }
            
            // Scroll through the session to find user messages visually
            console.log('5. Scrolling to find user messages...');
            
            // Take screenshots at different scroll positions
            const scrollPositions = [0, 0.25, 0.5, 0.75, 1.0];
            
            for (let i = 0; i < scrollPositions.length; i++) {
                const scrollPos = scrollPositions[i];
                
                await page.evaluate((pos) => {
                    const sessionDetail = document.querySelector('session-detail');
                    if (sessionDetail && sessionDetail.shadowRoot) {
                        const container = sessionDetail.shadowRoot.querySelector('.session-messages-container');
                        if (container) {
                            container.scrollTop = container.scrollHeight * pos;
                        }
                    }
                }, scrollPos);
                
                await page.waitForTimeout(2000);
                
                await page.screenshot({
                    path: path.join(screenshotsDir, `session-scroll-${Math.round(scrollPos * 100)}.png`),
                    fullPage: false
                });
                
                console.log(`   ✓ Screenshot at ${Math.round(scrollPos * 100)}% scroll`);
            }
            
            // Final comprehensive screenshot
            await page.screenshot({
                path: path.join(screenshotsDir, 'user-input-final-comprehensive.png'),
                fullPage: true
            });
            
        } else {
            console.log('! No session cards found');
        }
        
    } catch (error) {
        console.error('Error during final test:', error);
        await page.screenshot({
            path: path.join(screenshotsDir, 'final-test-error.png'),
            fullPage: true
        });
    } finally {
        await browser.close();
    }
    
    console.log('✓ Final user input test completed');
}

// Run the test
finalUserInputTest().catch(console.error);