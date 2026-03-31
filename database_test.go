package writefreely

import (
	"context"
	"database/sql"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestOAuthDatastore(t *testing.T) {
	if !runMySQLTests() {
		t.Skip("skipping mysql tests")
	}
	withTestDB(t, func(db *sql.DB) {
		ctx := context.Background()
		ds := &datastore{
			DB:         db,
			driverName: "",
		}

		state, err := ds.GenerateOAuthState(ctx, "test", "development", 0, "")
		assert.NoError(t, err)
		assert.Len(t, state, 24)

		countRows(t, ctx, db, 1, "SELECT COUNT(*) FROM `oauth_client_states` WHERE `state` = ? AND `used` = false", state)

		_, _, _, _, err = ds.ValidateOAuthState(ctx, state)
		assert.NoError(t, err)

		countRows(t, ctx, db, 1, "SELECT COUNT(*) FROM `oauth_client_states` WHERE `state` = ? AND `used` = true", state)

		var localUserID int64 = 99
		var remoteUserID = "100"
		err = ds.RecordRemoteUserID(ctx, localUserID, remoteUserID, "test", "test", "access_token_a")
		assert.NoError(t, err)

		countRows(t, ctx, db, 1, "SELECT COUNT(*) FROM `oauth_users` WHERE `user_id` = ? AND `remote_user_id` = ? AND access_token = 'access_token_a'", localUserID, remoteUserID)

		err = ds.RecordRemoteUserID(ctx, localUserID, remoteUserID, "test", "test", "access_token_b")
		assert.NoError(t, err)

		countRows(t, ctx, db, 1, "SELECT COUNT(*) FROM `oauth_users` WHERE `user_id` = ? AND `remote_user_id` = ? AND access_token = 'access_token_b'", localUserID, remoteUserID)

		countRows(t, ctx, db, 1, "SELECT COUNT(*) FROM `oauth_users`")

		foundUserID, err := ds.GetIDForRemoteUser(ctx, remoteUserID, "test", "test")
		assert.NoError(t, err)
		assert.Equal(t, localUserID, foundUserID)
	})
}

func TestShouldPreferDateSlug(t *testing.T) {
	testCases := map[string]struct {
		title    string
		expected bool
	}{
		"空タイトル単体ではCJK判定しない": {
			title:    "",
			expected: false,
		},
		"CJKタイトルは日付ベースにする": {
			title:    "こんにちは",
			expected: true,
		},
		"英語タイトルは日付ベースにしない": {
			title:    "hello-world",
			expected: false,
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.expected, shouldPreferDateSlug(tc.title))
		})
	}
}
