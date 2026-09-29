import sys

from app.repositories.user_repo import UserRepository


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/grant_platform_admin.py <email>")

    email = sys.argv[1]
    user = UserRepository.get_by_email(email)
    if not user:
        raise SystemExit(f"User not found: {email}")

    UserRepository.assign_role(user["id"], UserRepository.ADMIN_ROLE)
    print(f"Granted platform_admin to {email}")


if __name__ == "__main__":
    main()
