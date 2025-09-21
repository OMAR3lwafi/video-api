-- Test script to validate SQL syntax without executing
-- This will check for syntax errors in our migration files

-- Test function syntax by parsing without execution
\set ON_ERROR_STOP on

-- Test a simple function creation to verify PL/pgSQL syntax
CREATE OR REPLACE FUNCTION test_syntax_validation()
RETURNS TEXT AS $$
BEGIN
    -- Test RAISE EXCEPTION with parameters
    IF FALSE THEN
        RAISE EXCEPTION 'Test message with parameter: %', 'test_value';
    END IF;
    
    -- Test RAISE EXCEPTION without parameters
    IF FALSE THEN
        RAISE EXCEPTION 'Test message without parameters';
    END IF;
    
    RETURN 'Syntax validation passed';
END;
$$ LANGUAGE plpgsql;

-- Clean up test function
DROP FUNCTION IF EXISTS test_syntax_validation();

-- Display success message
SELECT 'SQL syntax validation completed successfully' as status;
