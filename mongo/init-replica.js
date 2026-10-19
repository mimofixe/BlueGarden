// Inicia o replica set rs0 com 3 membros. É idempotente: se já existir, não faz nada.
// Corre automaticamente no contentor "mongo-init".

try {
  const estado = rs.status();
  print("Replica set já iniciado: " + estado.set);
} catch (e) {
  print("A iniciar replica set rs0...");
  rs.initiate({
    _id: "rs0",
    members: [
      { _id: 0, host: "mongo1:27017", priority: 2 },
      { _id: 1, host: "mongo2:27017", priority: 1 },
      { _id: 2, host: "mongo3:27017", priority: 1 },
    ],
  });
}

// Espera até haver um primário eleito
for (let i = 0; i < 60; i++) {
  const h = db.hello();
  if (h.isWritablePrimary || h.primary) {
    print("Primário: " + (h.primary || "este nó"));
    quit(0);
  }
  sleep(1000);
}
print("Aviso: nenhum primário eleito após 60 s");
quit(1);
