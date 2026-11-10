import psycopg
from test_instance_data import _data_store, _create_instance, _database_url


def test_data_proof_accepts_additive_schema_but_rejects_changed_existing_rows(
    session_factory, tmp_path
):
    with _data_store(session_factory, tmp_path) as manager:
        with session_factory() as session:
            _, _, instance = _create_instance(session)
            session.commit()
        configuration = manager.provision(instance.id)
        with psycopg.connect(
            _database_url(configuration), autocommit=True
        ) as connection:
            connection.execute("CREATE TABLE notes(id integer PRIMARY KEY,value text)")
            connection.execute("INSERT INTO notes VALUES(1,'saved')")
        proof = manager.data_proof(instance.id)
        with psycopg.connect(
            _database_url(configuration), autocommit=True
        ) as connection:
            connection.execute("ALTER TABLE notes ADD COLUMN analysis text")
            connection.execute("INSERT INTO notes VALUES(2,'new','analysis')")
        assert manager.data_proof(instance.id, proof) is True
        with psycopg.connect(
            _database_url(configuration), autocommit=True
        ) as connection:
            connection.execute("UPDATE notes SET value='corrupted' WHERE id=1")
        assert manager.data_proof(instance.id, proof) is False
