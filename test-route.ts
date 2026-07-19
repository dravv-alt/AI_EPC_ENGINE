import { getMarineRoute } from './src/lib/marine-route.ts';

async function test() {
  const route = await getMarineRoute(18.95, 72.93, 19.08, 73.02);
  console.log("Mumbai Short:", route);
  
  const route2 = await getMarineRoute(18.95, 72.93, 34.05, -118.24); // Mumbai to LA
  console.log("Mumbai to LA length:", route2.length, route2[0]?.length);
}

test();
