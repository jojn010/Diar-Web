import test from 'node:test';
import assert from 'node:assert/strict';
import {formatPrice, relatedHomes} from '../../main/resources/static/listing-view.mjs';

test('prices consistently use English digits, grouping and whole dollars', () => {
  for (const [value, expected] of [[73500, '$73,500'], ['1500', '$1,500'], [1000000000, '$1,000,000,000']]) {
    assert.equal(formatPrice(value), expected);
    assert.doesNotMatch(formatPrice(value), /[٠-٩۰-۹]/);
  }
});
const current = {id:'current',purpose:'sale',type:'house',location:'القدس'};
test('more homes excludes the current listing and duplicate records', () => {
  const home = {id:'other',purpose:'rent',type:'apartment'};
  assert.deepEqual(relatedHomes([current, home, {...home}],current), [home]);
});
test('more homes prefers matching sale/rent and property type', () => {
  const rent = {id:'rent',purpose:'rent',type:'house'};
  const villa = {id:'villa',purpose:'sale',type:'villa'};
  const house = {...current,id:'house'};
  assert.deepEqual(relatedHomes([rent,villa,house],current).map(home=>home.id), ['house','villa','rent']);
});
test('the mini listing is bounded and keeps the source collection unchanged', () => {
  const homes = Array.from({length:8},(_,index)=>({...current,id:String(index)}));
  const before = structuredClone(homes);
  assert.equal(relatedHomes(homes,current).length,3);
  assert.deepEqual(homes,before);
  assert.deepEqual(relatedHomes(homes,current,0),[]);
});
test('a project with just this home does not invent recommendations', () => {
  assert.deepEqual(relatedHomes([current],current),[]);
  assert.deepEqual(relatedHomes([],current),[]);
});
