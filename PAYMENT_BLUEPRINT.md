# PayU Payment Integration Blueprint

## Overview
Integrate PayU payment gateway to allow users to self-subscribe via online payment (UPI/Card/NetBanking), while keeping the existing manual Telegram-based activation as a fallback.

---

## Configuration

```ts
const PAYMENT_CONFIG = {
  amount: "899",
  productInfo: "Powerhouse PYQ Premium - 1 Year",
  duration: 365, // days to add to expiryDate
  currency: "INR",
  gateway: "payu",
  payuBaseUrl: "https://secure.payu.in/_payment", // Live
  // payuBaseUrl: "https://test.payu.in/_payment", // Sandbox
};
```

---

## Credentials Needed (from PayU Dashboard)

| Item | Where to find |
|------|---------------|
| Merchant Key | PayU Dashboard → Settings → API Keys |
| Merchant Salt (v1) | PayU Dashboard → Settings → API Keys |
| Mode | Test (sandbox) or Live (production) |

Store as environment variables:
- `PAYU_MERCHANT_KEY`
- `PAYU_MERCHANT_SALT`
- `PAYU_BASE_URL`

---

## Architecture

### New Files
```
├── api/payment.ts              → Vercel serverless (all payment endpoints)
├── src/lib/payment.ts          → Frontend payment helper (initiate flow)
├── src/components/PaywallCard.tsx → Reusable subscription UI component
```

### Cosmos DB
- New container: `payments` (partition key: `/email`)
- Schema:
```json
{
  "id": "txn_1717612000000_abc123",
  "email": "user@example.com",
  "txnId": "TXN1717612000000",
  "amount": "899",
  "productInfo": "Powerhouse PYQ Premium - 1 Year",
  "status": "success|failure|pending",
  "gateway": "payu",
  "payuTxnId": "PayU's transaction ID",
  "paymentMode": "UPI|CC|DC|NB|WALLET",
  "payuResponse": { /* full PayU response object */ },
  "createdAt": "2026-06-06T00:00:00.000Z",
  "verifiedAt": "2026-06-06T00:00:05.000Z"
}
```

---

## API Endpoints

### POST `/api/payment/initiate`
**Input:** `{ email }`
**Logic:**
1. Generate unique `txnId` (e.g., `TXN_<timestamp>_<random>`)
2. Build hash string: `key|txnid|amount|productinfo|firstname|email|||||||||||salt`
3. Generate SHA-512 hash
4. Store pending transaction in `payments` container
5. Return: `{ hash, txnId, key, amount, productInfo, surl, furl, payuUrl }`

### POST `/api/payment/success` (PayU redirects here)
**Input:** PayU POST body (mihpayid, status, hash, txnid, etc.)
**Logic:**
1. Verify reverse hash: `salt|status|||||||||||email|firstname|productinfo|amount|txnid|key`
2. If valid:
   - Update `payments` record → status: "success"
   - Update `users` record → status: "subscribed", expiryDate: +365 days
3. Redirect to: `https://powerhouse-pyq-dev.vercel.app?payment=success`

### POST `/api/payment/failure` (PayU redirects here)
**Input:** PayU POST body
**Logic:**
1. Update `payments` record → status: "failure"
2. Redirect to: `https://powerhouse-pyq-dev.vercel.app?payment=failed`

### POST `/api/payment/webhook` (Server-to-server notification)
**Input:** PayU webhook payload
**Logic:**
1. Verify hash
2. Handle edge cases (user closed browser but payment succeeded)
3. Update user status if not already updated

---

## Frontend Flow

### PaywallCard Component
```
┌─────────────────────────────────────┐
│  🔓 Unlock All Questions            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ₹899 / year                │    │
│  │  ✓ All subjects & years     │    │
│  │  ✓ 2026 predictions         │    │
│  │  ✓ Topper's copies          │    │
│  │  ✓ Future updates           │    │
│  │                             │    │
│  │  [ 💳 Pay Now ₹899 ]       │    │
│  └─────────────────────────────┘    │
│                                     │
│  ────────── or ──────────           │
│                                     │
│  📱 Contact @INDIAN4 on Telegram    │
│  [QR Code]                          │
│  [ 🔄 Check Status ]               │
└─────────────────────────────────────┘
```

### Payment Initiation (Frontend)
```ts
async function initiatePayment(email: string) {
  // 1. Call backend to get hash & form data
  const res = await fetch('/api/payment/initiate', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  const data = await res.json();

  // 2. Create hidden form & auto-submit to PayU
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = data.payuUrl;
  
  const fields = {
    key: data.key,
    txnid: data.txnId,
    amount: data.amount,
    productinfo: data.productInfo,
    firstname: email.split('@')[0],
    email: email,
    phone: '',
    surl: data.surl,
    furl: data.furl,
    hash: data.hash,
  };

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
```

### Success Handling (App.tsx)
```ts
// On app load, check URL params
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    toast.success('Payment successful! Your subscription is now active.');
    window.history.replaceState({}, '', '/');
    checkUserStatus(userEmail); // Refresh subscription status
  } else if (params.get('payment') === 'failed') {
    toast.error('Payment failed. Please try again.');
    window.history.replaceState({}, '', '/');
  }
}, []);
```

---

## Hash Generation (Server-side)

```ts
import crypto from 'crypto';

function generateHash(key: string, txnId: string, amount: string, 
  productInfo: string, firstName: string, email: string, salt: string): string {
  const hashString = `${key}|${txnId}|${amount}|${productInfo}|${firstName}|${email}|||||||||||${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

function verifyReverseHash(salt: string, status: string, email: string, 
  firstName: string, productInfo: string, amount: string, txnId: string, 
  key: string, additionalCharges: string, receivedHash: string): boolean {
  const hashString = `${salt}|${status}|||||||||||${email}|${firstName}|${productInfo}|${amount}|${txnId}|${key}`;
  const generated = crypto.createHash('sha512').update(hashString).digest('hex');
  return generated === receivedHash;
}
```

---

## Security Checklist

- [ ] Never expose Merchant Salt on frontend
- [ ] Always verify reverse hash on success callback
- [ ] Use webhook as backup verification (user may close browser)
- [ ] Store full PayU response for dispute resolution
- [ ] Validate amount matches expected (prevent tampering)
- [ ] Use HTTPS for all callbacks (Vercel handles this)

---

## Extensibility

| Feature | How to add |
|---------|-----------|
| Monthly plan | Add plan selection UI, different amount/duration |
| Coupons/Discounts | Validate coupon code in `/initiate`, adjust amount |
| Refunds | New endpoint calling PayU Refund API |
| Switch to Razorpay | Replace `api/payment.ts` logic, keep same DB schema |
| Auto-renewal | Store recurring token from PayU SI (Standing Instructions) |
| Invoice/Receipt | Generate PDF from `payments` container data |

---

## Environment Variables (Vercel)

```
PAYU_MERCHANT_KEY=<your_key>
PAYU_MERCHANT_SALT=<your_salt>
PAYU_BASE_URL=https://secure.payu.in/_payment
APP_BASE_URL=https://powerhouse-pyq-dev.vercel.app
```

---

## TODO (Implementation Steps)

1. [ ] Get PayU credentials (Merchant Key + Salt)
2. [ ] Create `payments` container in Cosmos DB
3. [ ] Build `api/payment.ts` with all 4 endpoints
4. [ ] Add `PAYU_*` env vars to Vercel project
5. [ ] Build `PaywallCard.tsx` component
6. [ ] Integrate PaywallCard in App.tsx (replace current lock screen)
7. [ ] Add payment success/failure URL param handling
8. [ ] Test with PayU sandbox
9. [ ] Switch to PayU live credentials
10. [ ] Deploy to production

---

*Created: 2026-06-05 | Price: ₹899/year | Gateway: PayU*
