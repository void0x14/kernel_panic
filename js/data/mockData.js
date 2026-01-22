/**
 * Mock Data Generator for The Segmented Tunnel
 * Generates years/months and associated content items.
 */

const CONTENT_TYPES = ['text', 'image', 'video', 'audio'];

const LOREM_TITLES = [
    "Neural Interface V1", "Quantum Decay", "Sub-routine Analysis",
    "Memory Fragment 0x4A", "System Override", "Void Protocol",
    "Echoes of Silence", "Binary Drift", "Kernel Optimization",
    "Visual Syntax Error"
];

export const generateMockData = (tunnelLengthSegments) => {
    const data = [];
    const startYear = 2088;

    for (let i = 0; i < tunnelLengthSegments * 2; i++) { // Generate enough for initial pool + buffer
        const segmentData = {
            id: `seg-${i}`,
            ringIndex: i,
            label: `${startYear - i}`, // Years counting backwards
            items: []
        };

        // Random number of items per ring (e.g., 2-5 items)
        const itemCount = Math.floor(Math.random() * 4) + 2;

        for (let j = 0; j < itemCount; j++) {
            segmentData.items.push({
                id: `item-${i}-${j}`,
                type: CONTENT_TYPES[Math.floor(Math.random() * CONTENT_TYPES.length)],
                title: LOREM_TITLES[Math.floor(Math.random() * LOREM_TITLES.length)],
                // Random angle for placement (0 to 2PI)
                angle: Math.random() * Math.PI * 2
            });
        }

        data.push(segmentData);
    }
    return data;
};
