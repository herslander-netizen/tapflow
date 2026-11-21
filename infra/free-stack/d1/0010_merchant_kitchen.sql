-- TapFlow pilot only. Adds audit command records; grants no privileges.
CREATE TABLE merchant_kitchen_transitions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id,location_id) REFERENCES locations(tenant_id,id),
  FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),
  CHECK (
    (old_status='submitted' AND new_status IN ('accepted','rejected')) OR
    (old_status='accepted' AND new_status='preparing') OR
    (old_status='preparing' AND new_status='ready') OR
    (old_status='ready' AND new_status='completed')
  ),
  CHECK (
    (new_status='rejected' AND reason IS NOT NULL AND length(trim(reason)) BETWEEN 1 AND 240) OR
    (new_status<>'rejected' AND reason IS NULL)
  )
);

CREATE INDEX idx_kitchen_transition_scope ON merchant_kitchen_transitions(tenant_id,location_id,order_id,created_at);

CREATE TRIGGER merchant_kitchen_apply_transition
AFTER INSERT ON merchant_kitchen_transitions
BEGIN
  UPDATE orders SET status=NEW.new_status,updated_at=NEW.created_at
    WHERE tenant_id=NEW.tenant_id AND location_id=NEW.location_id AND id=NEW.order_id
      AND status=NEW.old_status AND payment_status='not_required';
  SELECT CASE WHEN changes()<>1 THEN RAISE(ABORT,'invalid kitchen transition') END;
  INSERT INTO order_events(id,tenant_id,order_id,action,actor_type,actor_id,reason,created_at)
    VALUES(NEW.id,NEW.tenant_id,NEW.order_id,NEW.new_status,'staff',NEW.staff_id,NEW.reason,NEW.created_at);
END;
