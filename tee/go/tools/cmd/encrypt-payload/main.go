package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"

	"sign-tools/base/fccutils"

	"github.com/ethereum/go-ethereum/crypto/ecies"
	"github.com/flare-foundation/tee-node/pkg/types"
)

func main() {
	proxyURL := "http://localhost:6676"
	if len(os.Args) > 1 {
		proxyURL = os.Args[1]
	}

	teeInfo, err := fccutils.TeeInfo(proxyURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error fetching TEE info: %v\n", err)
		os.Exit(1)
	}

	ecdsaPub, err := types.ParsePubKey(teeInfo.TeeInfo.PublicKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error parsing public key: %v\n", err)
		os.Exit(1)
	}

	eciesPub := &ecies.PublicKey{
		X:      ecdsaPub.X,
		Y:      ecdsaPub.Y,
		Curve:  ecies.DefaultCurve,
		Params: ecies.ECIES_AES128_SHA256,
	}

	payload := `{"plaid_access_token":"access-sandbox-b300f541-c41c-4eda-9c63-af7015e0f10d","user_address":"0x1A5C418505e2Cd6426BaD9Fd0EE453B031A14e83"}`

	ct, err := ecies.Encrypt(rand.Reader, eciesPub, []byte(payload), nil, nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "encrypt error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("0x%s\n", hex.EncodeToString(ct))
}
