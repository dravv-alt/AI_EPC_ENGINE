const searoute = require('searoute-js');
console.log("typeof searoute:", typeof searoute);
// Let's also test a route
const origin = [72.8777, 19.0760]; // Mumbai
const dest = [-118.2437, 34.0522]; // LA
console.log("Trying searoute as a function...");
try {
  const route = searoute(origin, dest);
  console.log("Route calculated. Feature type:", route.type);
  if (route.geometry) {
    console.log("Geometry type:", route.geometry.type);
    console.log("Coordinates count:", route.geometry.coordinates.length);
  }
} catch (e) {
  console.error("Error:", e.message);
}
