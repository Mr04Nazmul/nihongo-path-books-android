import {test} from 'node:test';import assert from 'node:assert/strict';
import {entitlement} from '../supabase/functions/nihongo-play-billing/policy.mjs';
const now=Date.parse('2026-11-05T00:00:00Z');
const purchase=(state='SUBSCRIPTION_STATE_ACTIVE')=>({subscriptionState:state,testPurchase:{},externalAccountIdentifiers:{obfuscatedExternalAccountId:'owner'},lineItems:[{productId:'nihongo_premium',offerDetails:{basePlanId:'monthly'},expiryTime:'2026-12-05T00:00:00Z',autoRenewingPlan:{autoRenewEnabled:true}}]});
test('active, renewal, grace and paid-through cancellation retain access',()=>{for(const state of ['ACTIVE','IN_GRACE_PERIOD','CANCELED'])assert.equal(entitlement(purchase('SUBSCRIPTION_STATE_'+state),'owner','test',now).active,true)});
test('pending, hold, pause, expiration and revoked states never grant',()=>{for(const state of ['PENDING','ON_HOLD','PAUSED','EXPIRED','PENDING_PURCHASE_CANCELED'])assert.equal(entitlement(purchase('SUBSCRIPTION_STATE_'+state),'owner','test',now).active,false)});
test('expired paid-through cancellation loses access',()=>{assert.equal(entitlement(purchase('SUBSCRIPTION_STATE_CANCELED'),'owner','test',Date.parse('2026-12-06')).active,false)});
test('reject account switching, wrong product, wrong base plan and disabled/live purchases in test mode',()=>{
 assert.throws(()=>entitlement(purchase(),'other','test',now));assert.throws(()=>entitlement(purchase(),'owner','disabled',now));
 const p=purchase();delete p.testPurchase;assert.throws(()=>entitlement(p,'owner','test',now));
 p.testPurchase={};p.lineItems[0].productId='other';assert.throws(()=>entitlement(p,'owner','test',now));
 p.lineItems[0].productId='nihongo_premium';p.lineItems[0].offerDetails.basePlanId='yearly';assert.throws(()=>entitlement(p,'owner','test',now));
});
