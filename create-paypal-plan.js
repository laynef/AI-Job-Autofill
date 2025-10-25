#!/usr/bin/env node

// Script to create PayPal subscription plan automatically
const https = require('https');

const PAYPAL_CLIENT_ID = 'Afi-D_TFUCNLZun1AEyBNjJGEeKNuhDcDsUgchF1kR1zPnmxlrHGGP29h8Y--RlXFSth7Ge83FJuOacF';
const PAYPAL_SECRET = 'ELw7akEZZtZEacTRXDkhm8z8-sXCgNALrm7EalKMKpVYU3krdje93-yXIBAZigv8mk6FNODO4cys328S';
const PAYPAL_API = 'https://api-m.paypal.com'; // Live mode

console.log('🚀 Creating PayPal Subscription Plan...\n');

// Step 1: Get Access Token
function getAccessToken() {
    return new Promise((resolve, reject) => {
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');

        const options = {
            hostname: 'api-m.paypal.com',
            path: '/v1/oauth2/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const token = JSON.parse(data).access_token;
                    console.log('✅ Got Access Token');
                    resolve(token);
                } else {
                    console.error('❌ Failed to get access token:', data);
                    reject(new Error(data));
                }
            });
        });

        req.on('error', reject);
        req.write('grant_type=client_credentials');
        req.end();
    });
}

// Step 2: Create Product
function createProduct(accessToken) {
    return new Promise((resolve, reject) => {
        const productData = JSON.stringify({
            name: 'Hired Always Monthly Subscription',
            description: 'AI-powered job application assistant with unlimited autofills',
            type: 'SERVICE',
            category: 'SOFTWARE',
            image_url: 'https://hiredalways.com/images/icon128.png',
            home_url: 'https://hiredalways.com'
        });

        const options = {
            hostname: 'api-m.paypal.com',
            path: '/v1/catalogs/products',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': productData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 201) {
                    const product = JSON.parse(data);
                    console.log('✅ Created Product:', product.name);
                    console.log('   Product ID:', product.id);
                    resolve(product.id);
                } else {
                    console.error('❌ Failed to create product:', data);
                    reject(new Error(data));
                }
            });
        });

        req.on('error', reject);
        req.write(productData);
        req.end();
    });
}

// Step 3: Create Subscription Plan
function createPlan(accessToken, productId) {
    return new Promise((resolve, reject) => {
        const planData = JSON.stringify({
            product_id: productId,
            name: 'Hired Always Monthly Plan',
            description: '$9.99 per month for unlimited AI-powered job application autofills',
            status: 'ACTIVE',
            billing_cycles: [
                {
                    frequency: {
                        interval_unit: 'MONTH',
                        interval_count: 1
                    },
                    tenure_type: 'REGULAR',
                    sequence: 1,
                    total_cycles: 0, // 0 = unlimited
                    pricing_scheme: {
                        fixed_price: {
                            value: '9.99',
                            currency_code: 'USD'
                        }
                    }
                }
            ],
            payment_preferences: {
                auto_bill_outstanding: true,
                setup_fee: {
                    value: '0',
                    currency_code: 'USD'
                },
                setup_fee_failure_action: 'CONTINUE',
                payment_failure_threshold: 3
            },
            taxes: {
                percentage: '0',
                inclusive: false
            }
        });

        const options = {
            hostname: 'api-m.paypal.com',
            path: '/v1/billing/plans',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': planData.length,
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 201) {
                    const plan = JSON.parse(data);
                    console.log('✅ Created Subscription Plan:', plan.name);
                    console.log('\n🎉 SUCCESS! Your Plan ID is:\n');
                    console.log('   ' + plan.id);
                    console.log('\n📝 Now update website/purchase.html line 270:');
                    console.log(`   'plan_id': '${plan.id}',`);
                    console.log('\n✅ Status:', plan.status);
                    console.log('💵 Price: $9.99/month');
                    resolve(plan);
                } else {
                    console.error('❌ Failed to create plan:', data);
                    reject(new Error(data));
                }
            });
        });

        req.on('error', reject);
        req.write(planData);
        req.end();
    });
}

// Run the script
async function main() {
    try {
        console.log('Step 1: Getting PayPal access token...');
        const accessToken = await getAccessToken();

        console.log('\nStep 2: Creating product...');
        const productId = await createProduct(accessToken);

        console.log('\nStep 3: Creating subscription plan...');
        const plan = await createPlan(accessToken, productId);

        console.log('\n✅ ALL DONE! Copy the Plan ID above and update purchase.html');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main();
