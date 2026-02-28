# Bootstrap Admin Supabase

## Objectif

Appliquer le modèle de rôles aligné avec l'application, puis créer le premier admin côté serveur sans dépendre du navigateur.

## Pré-requis

- Accès SQL au projet Supabase cible
- Vérifier que l'environnement visé est bien le bon
- Avoir déjà tourné les secrets exposés si des clés ou mots de passe ont été partagés hors d'un coffre

## 1. Appliquer la migration

Exécuter [046_admin_roles_alignment.sql](/C:/Github-Desktop/CASHPILOT/supabase/migrations/046_admin_roles_alignment.sql) sur le projet Supabase cible.

Cette migration :

- crée ou aligne `public.user_roles`
- crée ou aligne `public.role_permissions`
- ajoute `public.is_admin()`
- pose les policies RLS
- seed les permissions canoniques

## 2. Bootstrapper le premier admin

Exécuter ensuite une attribution explicite côté SQL :

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'replace-with-real-admin@example.com'
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role,
    updated_at = now();
```

## 3. Vérifier l'attribution

```sql
SELECT u.email, ur.role, ur.created_at, ur.updated_at
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin';
```

## 4. Vérifier côté application

- connexion avec le compte admin réel
- accès à `/admin`
- accès à `/admin/seed-data`
- lecture de `user_roles` et `role_permissions`

## 5. Vérifier les scripts MCP

Renseigner `mcp-server/.env` à partir de [mcp-server/.env.example](/C:/Github-Desktop/CASHPILOT/mcp-server/.env.example), puis exécuter :

```bash
cd mcp-server
npm run test:admin
npm run test:round2
```

## Notes

- Ne pas utiliser le seed navigateur pour créer un admin.
- `profiles.role` reste un attribut de profil, pas la source d'autorité des rôles élevés.
- Les privilèges élevés doivent être attribués côté serveur dans `public.user_roles`.
