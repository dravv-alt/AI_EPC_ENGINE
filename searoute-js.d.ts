declare module 'searoute-js' {
  const searoute: (origin: number[], dest: number[]) => {
    type: string;
    geometry: {
      type: string;
      coordinates: any;
    };
  };
  export default searoute;
}
