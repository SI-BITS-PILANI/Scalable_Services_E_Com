-- Dedicated credentials + database for order-service.
CREATE USER order_user WITH PASSWORD 'order_password';
CREATE DATABASE order_db OWNER order_user;
