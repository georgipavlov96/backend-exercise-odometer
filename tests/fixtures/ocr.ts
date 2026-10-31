export const suppliedImages = [
  { filename: '33c24909-e9dd-46d3-8e7f-c44fd9896537.jpeg', expected: { reading: 62690.5, unit: 'miles', confidence: 'high' } },
  { filename: '3ae9d173-8895-409e-844c-77b5841138d7.jpeg', expected: { reading: 161967, unit: 'miles', confidence: 'med' } },
  { filename: 'd621e37e-7c0f-49a4-8a19-d628b1e82a33.jpeg', expected: { reading: 154510, unit: 'miles', confidence: 'med' } },
  { filename: 'dbab9932-823e-49ed-80db-1e898d836d5e.jpeg', expected: { reading: 205265, unit: 'miles', confidence: 'med' } },
  { filename: 'odometer-blurry.png', expected: { reading: 48253, unit: 'miles', confidence: 'med' } },
];

export const unreadable = {
  error: 'UNREADABLE_IMAGE',
  message: 'Could not extract a mileage reading from the provided image',
} as const;
