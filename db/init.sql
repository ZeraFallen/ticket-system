CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tickets (title, status) VALUES 
('Lab 302 PC-05 Display Error', 'OPEN'),
('Network wall jack inactive in Lab 304', 'IN_PROGRESS');
