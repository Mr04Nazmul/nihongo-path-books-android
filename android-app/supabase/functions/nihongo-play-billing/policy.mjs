export const PACKAGE='online.devnazu.books', PRODUCT='nihongo_premium', PLAN='monthly';
export function entitlement(p, owner, mode, now=Date.now()) {
 if(!['test','live'].includes(mode)) throw Error('Billing is not activated');
 if(mode==='test'&&!p.testPurchase) throw Error('Only Google Play test purchases are enabled');
 if(p.externalAccountIdentifiers?.obfuscatedExternalAccountId!==owner) throw Error('Purchase belongs to another app account');
 const lines=(p.lineItems||[]).filter(x=>x.productId===PRODUCT && x.offerDetails?.basePlanId===PLAN);
 if(!lines.length) throw Error('Incorrect product or base plan');
 const expires=Math.max(...lines.map(x=>Date.parse(x.expiryTime)||0));
 const state=p.subscriptionState;
 const active=['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED'].includes(state)&&expires>now;
 return {state,active,expiresAt:new Date(expires).toISOString(),autoRenewing:lines.some(x=>x.autoRenewingPlan?.autoRenewEnabled===true),test:!!p.testPurchase};
}
