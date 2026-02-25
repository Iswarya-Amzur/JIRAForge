/**
 * NotifMe Wrapper Unit Tests
 */

const assert = require('assert');

// Mock notifme-sdk
const mockSend = jest.fn();
jest.mock('notifme-sdk', () => {
    return jest.fn().mockImplementation(() => ({
        send: mockSend
    }));
});

// Mock logger
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

describe('NotifMe Wrapper', () => {
    let notifmeWrapper;
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        
        // Set up default environment
        process.env = {
            ...originalEnv,
            EMAIL_PROVIDER: 'sendgrid',
            SENDGRID_API_KEY: 'test-sendgrid-key',
            EMAIL_FROM: 'test@example.com',
            EMAIL_FROM_NAME: 'Test App'
        };
        
        // Re-require after resetting modules
        notifmeWrapper = require('../../src/services/notifications/notifme-wrapper');
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('initialize', () => {
        it('should initialize with SendGrid provider', () => {
            notifmeWrapper.initialize();
            expect(notifmeWrapper.provider).toBeDefined();
        });

        it('should not reinitialize if already initialized', () => {
            notifmeWrapper.initialize();
            const firstProvider = notifmeWrapper.provider;
            notifmeWrapper.initialize();
            // Provider reference should be the same
            expect(notifmeWrapper.provider).toBe(firstProvider);
        });

        it('should initialize with SMTP provider', () => {
            process.env.EMAIL_PROVIDER = 'smtp';
            process.env.SMTP_HOST = 'smtp.example.com';
            process.env.SMTP_PORT = '587';
            process.env.SMTP_USER = 'user';
            process.env.SMTP_PASSWORD = 'pass';
            
            jest.resetModules();
            notifmeWrapper = require('../../src/services/notifications/notifme-wrapper');
            notifmeWrapper.initialize();
            
            expect(notifmeWrapper.provider).toBeDefined();
        });

        it('should initialize with Mailgun provider', () => {
            process.env.EMAIL_PROVIDER = 'mailgun';
            process.env.MAILGUN_API_KEY = 'test-mailgun-key';
            process.env.MAILGUN_DOMAIN = 'mg.example.com';
            
            jest.resetModules();
            notifmeWrapper = require('../../src/services/notifications/notifme-wrapper');
            notifmeWrapper.initialize();
            
            expect(notifmeWrapper.provider).toBeDefined();
        });
    });

    describe('send', () => {
        beforeEach(() => {
            mockSend.mockResolvedValue({
                status: 'success',
                channels: { email: { id: 'test-id' } }
            });
        });

        it('should send email successfully', async () => {
            notifmeWrapper.initialize();
            
            const result = await notifmeWrapper.send({
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test body',
                html: '<p>Test body</p>'
            });

            expect(result.success).toBe(true);
            expect(mockSend).toHaveBeenCalled();
        });

        it('should auto-initialize if not initialized', async () => {
            const result = await notifmeWrapper.send({
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test body'
            });

            expect(result.success).toBe(true);
        });

        it('should use default from address', async () => {
            notifmeWrapper.initialize();
            
            await notifmeWrapper.send({
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test body'
            });

            expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
                email: expect.objectContaining({
                    from: expect.stringContaining('test@example.com')
                })
            }));
        });

        it('should allow custom from address', async () => {
            notifmeWrapper.initialize();
            
            await notifmeWrapper.send({
                to: 'recipient@example.com',
                from: 'custom@example.com',
                fromName: 'Custom Sender',
                subject: 'Test Subject',
                text: 'Test body'
            });

            expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
                email: expect.objectContaining({
                    from: expect.stringContaining('custom@example.com')
                })
            }));
        });

        it('should handle send failure', async () => {
            mockSend.mockRejectedValue(new Error('Send failed'));
            notifmeWrapper.initialize();
            
            const result = await notifmeWrapper.send({
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test body'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Send failed');
        });

        it('should support CC and BCC', async () => {
            notifmeWrapper.initialize();
            
            await notifmeWrapper.send({
                to: 'recipient@example.com',
                cc: 'cc@example.com',
                bcc: 'bcc@example.com',
                subject: 'Test Subject',
                text: 'Test body'
            });

            expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
                email: expect.objectContaining({
                    cc: ['cc@example.com'],
                    bcc: ['bcc@example.com']
                })
            }));
        });
    });

    describe('getStatus', () => {
        it('should return status information', () => {
            notifmeWrapper.initialize();
            
            const status = notifmeWrapper.getStatus();
            
            expect(status).toHaveProperty('initialized');
            expect(status).toHaveProperty('provider');
            expect(status).toHaveProperty('fromEmail');
        });
    });
});

// Utility function tests
describe('NotifMe Wrapper - Provider Config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should build SendGrid config correctly', () => {
        process.env.EMAIL_PROVIDER = 'sendgrid';
        process.env.SENDGRID_API_KEY = 'SG.test-api-key';
        
        const NotifmeSdk = require('notifme-sdk');
        require('../../src/services/notifications/notifme-wrapper').initialize();
        
        expect(NotifmeSdk).toHaveBeenCalledWith(
            expect.objectContaining({
                channels: expect.objectContaining({
                    email: expect.objectContaining({
                        providers: expect.arrayContaining([
                            expect.objectContaining({
                                type: 'sendgrid',
                                apiKey: 'SG.test-api-key'
                            })
                        ])
                    })
                })
            })
        );
    });

    it('should warn when no provider configured', () => {
        process.env = {};
        const logger = require('../../src/utils/logger');
        
        require('../../src/services/notifications/notifme-wrapper').initialize();
        
        expect(logger.warn).toHaveBeenCalled();
    });
});
