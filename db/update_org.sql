INSERT INTO organizations (id, organization_name)
VALUES ('FOCALTESTORG1', 'Focal Test Organization');

UPDATE users
SET organization_id = 'FOCALTESTORG1'
WHERE id = 'b12b2590-10e1-703d-9fd1-522aa6bedf91';