const assert = require('assert');

function calculateTicketPriority(issueLength) {
    if (issueLength > 10) return 'HIGH';
    return 'LOW';
}

try {
    assert.strictEqual(calculateTicketPriority(15), 'HIGH');
    assert.strictEqual(calculateTicketPriority(5), 'LOW');
    console.log("✅ All unit tests passed successfully!");
    process.exit(0);
} catch (err) {
    console.error("❌ Test failed:", err.message);
    process.exit(1);
}
