import hashlib
import os
import zlib

import pytest

from .support import finish, post_job

EMPTY = {
    "md5": "d41d8cd98f00b204e9800998ecf8427e",
    "sha1": "da39a3ee5e6b4b0d3255bfef95601890afd80709",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "sha512": "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    "sha3_256": "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
    "blake3": "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262",
    "xxh64": "ef46db3751d8e999",
    "crc32": "00000000",
}
ABC = {
    "md5": "900150983cd24fb0d6963f7d28e17f72",
    "sha1": "a9993e364706816aba3e25717850c26c9cd0d89d",
    "sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "sha512": "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    "sha3_256": "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532",
    "blake3": "6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85",
    "xxh64": "44bc2cf5ad770999",
    "crc32": "352441c2",
}


def hash_one(client, path, algorithms):
    job = post_job(client, "/api/hash", {"paths": [str(path)], "algorithms": algorithms})
    assert job["state"] == "done", job
    return job["result"]["items"]


@pytest.mark.parametrize("algorithm", sorted(EMPTY))
def test_hashing_an_empty_file_gives_the_published_empty_input_digest(client, tmp_path, algorithm):
    target = tmp_path / "empty"
    target.write_bytes(b"")
    items = hash_one(client, target, [algorithm])
    assert items == [{"path": str(target), "size": 0, "hashes": {algorithm: EMPTY[algorithm]}}]


@pytest.mark.parametrize("algorithm", sorted(ABC))
def test_hashing_abc_gives_the_published_test_vector(client, tmp_path, algorithm):
    target = tmp_path / "abc.txt"
    target.write_bytes(b"abc")
    assert hash_one(client, target, [algorithm])[0]["hashes"] == {algorithm: ABC[algorithm]}


def test_crc32_of_the_standard_check_string_is_cbf43926(client, tmp_path):
    target = tmp_path / "check"
    target.write_bytes(b"123456789")
    assert hash_one(client, target, ["crc32"])[0]["hashes"]["crc32"] == "cbf43926"


def test_a_file_larger_than_one_read_block_hashes_like_hashlib_in_one_pass(client, tmp_path):
    payload = os.urandom(1024 * 1024 * 2 + 12345)
    target = tmp_path / "big.bin"
    target.write_bytes(payload)
    hashes = hash_one(client, target, ["md5", "sha256", "sha512", "crc32"])[0]["hashes"]
    assert hashes == {
        "md5": hashlib.md5(payload).hexdigest(),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "sha512": hashlib.sha512(payload).hexdigest(),
        "crc32": f"{zlib.crc32(payload) & 0xFFFFFFFF:08x}",
    }


def test_a_folder_expands_to_every_file_in_sorted_order_with_sizes(client, tmp_path):
    (tmp_path / "b").mkdir()
    (tmp_path / "b" / "z.txt").write_bytes(b"zz")
    (tmp_path / "b" / "a.txt").write_bytes(b"a")
    (tmp_path / "c.txt").write_bytes(b"ccc")
    job = post_job(client, "/api/hash", {"paths": [str(tmp_path)]})
    items = job["result"]["items"]
    assert [os.path.relpath(i["path"], tmp_path) for i in items] == [os.path.join("c.txt"), os.path.join("b", "a.txt"), os.path.join("b", "z.txt")]
    assert [i["size"] for i in items] == [3, 1, 2]
    assert [i["hashes"]["sha256"] for i in items] == [hashlib.sha256(b) .hexdigest() for b in (b"ccc", b"a", b"zz")]
    assert job["done"] == job["total"] == 6


def test_the_default_algorithm_is_sha256_only(client, tmp_path):
    target = tmp_path / "x"
    target.write_bytes(b"abc")
    job = post_job(client, "/api/hash", {"paths": [str(target)]})
    assert job["result"]["items"][0]["hashes"] == {"sha256": ABC["sha256"]}


def test_algorithm_names_are_case_insensitive_and_duplicates_collapse(client, tmp_path):
    target = tmp_path / "x"
    target.write_bytes(b"abc")
    hashes = hash_one(client, target, ["MD5", "md5", "SHA3-256"])[0]["hashes"]
    assert hashes == {"md5": ABC["md5"], "sha3_256": ABC["sha3_256"]}


def test_an_unknown_algorithm_is_refused_with_the_supported_list(client, tmp_path):
    target = tmp_path / "x"
    target.write_bytes(b"abc")
    reply = client.post("/api/hash", json={"paths": [str(target)], "algorithms": ["whirlpool"]})
    assert reply.status_code == 400
    assert reply.json()["error"] == "whirlpool is not a supported algorithm; use md5, sha1, sha256, sha512, sha3_256, blake3, xxh64, crc32"


def test_hashing_a_missing_path_is_refused_with_its_name(client, tmp_path):
    reply = client.post("/api/hash", json={"paths": [str(tmp_path / "ghost.bin")]})
    assert (reply.status_code, reply.json()["error"]) == (404, "ghost.bin does not exist")


def test_hashing_an_empty_folder_is_refused(client, tmp_path):
    reply = client.post("/api/hash", json={"paths": [str(tmp_path)]})
    assert (reply.status_code, reply.json()["error"]) == (400, "there are no files to hash")


def test_hashing_a_relative_path_is_refused(client):
    reply = client.post("/api/hash", json={"paths": ["relative/file.txt"]})
    assert (reply.status_code, reply.json()["error"]) == (400, "the path must be absolute")


def write_pair(folder):
    (folder / "good.txt").write_bytes(b"abc")
    (folder / "bad.txt").write_bytes(b"abd")


def verify(client, sums):
    job = post_job(client, "/api/hash/verify", {"path": str(sums)})
    assert job["state"] == "done", job
    return job["result"]


def test_verify_a_sha256sum_file_counts_good_bad_and_missing_entries(client, tmp_path):
    write_pair(tmp_path)
    sums = tmp_path / "SHA256SUMS"
    digest = ABC["sha256"]
    sums.write_text(f"{digest}  good.txt\n{digest} *bad.txt\n{digest}  gone.txt\n", encoding="utf-8")
    result = verify(client, sums)
    assert (result["ok"], result["failed"], result["missing"]) == (1, 1, 1)
    by_name = {os.path.basename(i["path"]): i for i in result["items"]}
    assert by_name["good.txt"]["ok"] is True
    assert by_name["bad.txt"]["actual"] == hashlib.sha256(b"abd").hexdigest()
    assert by_name["gone.txt"]["missing"] is True and by_name["gone.txt"]["actual"] is None


def test_verify_reads_bsd_tagged_lines_for_several_algorithms(client, tmp_path):
    write_pair(tmp_path)
    sums = tmp_path / "CHECKSUMS"
    sums.write_text(f"MD5 (good.txt) = {ABC['md5']}\nSHA1 (good.txt) = {ABC['sha1']}\nSHA512 (bad.txt) = {ABC['sha512']}\n", encoding="utf-8")
    result = verify(client, sums)
    assert (result["ok"], result["failed"], result["missing"]) == (2, 1, 0)


def test_verify_reads_an_sfv_file_as_crc32(client, tmp_path):
    write_pair(tmp_path)
    sums = tmp_path / "files.sfv"
    sums.write_text(f"; made by hand\ngood.txt {ABC['crc32']}\nbad.txt {ABC['crc32']}\n", encoding="utf-8")
    result = verify(client, sums)
    assert (result["ok"], result["failed"]) == (1, 1)
    assert result["items"][1]["actual"] == f"{zlib.crc32(b'abd'):08x}"


def test_verify_accepts_uppercase_digests_and_a_utf8_bom(client, tmp_path):
    write_pair(tmp_path)
    sums = tmp_path / "list.md5"
    sums.write_bytes(b"\xef\xbb\xbf" + f"{ABC['md5'].upper()}  good.txt\r\n".encode("ascii"))
    result = verify(client, sums)
    assert (result["ok"], result["failed"], result["missing"]) == (1, 0, 0)
    assert result["items"][0]["expected"] == ABC["md5"]


def test_verify_a_file_with_no_checksums_is_refused(client, tmp_path):
    sums = tmp_path / "notes.txt"
    sums.write_text("just words\nno digests here\n", encoding="utf-8")
    reply = client.post("/api/hash/verify", json={"path": str(sums)})
    assert (reply.status_code, reply.json()["error"]) == (400, "no checksums were found in that file")


def test_verify_a_missing_checksum_file_is_refused(client, tmp_path):
    reply = client.post("/api/hash/verify", json={"path": str(tmp_path / "SHA256SUMS")})
    assert (reply.status_code, reply.json()["error"]) == (404, "that checksum file does not exist")


def test_hashes_written_by_the_app_verify_cleanly_through_the_app(client, tmp_path):
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "one.bin").write_bytes(os.urandom(5000))
    (tmp_path / "data" / "two.bin").write_bytes(b"")
    items = post_job(client, "/api/hash", {"paths": [str(tmp_path / "data")], "algorithms": ["sha512"]})["result"]["items"]
    sums = tmp_path / "data" / "SHA512SUMS"
    sums.write_text("".join(f"{i['hashes']['sha512']}  {os.path.basename(i['path'])}\n" for i in items), encoding="utf-8")
    result = verify(client, sums)
    assert (result["ok"], result["failed"], result["missing"]) == (2, 0, 0)


def test_a_finished_hash_job_is_reported_by_the_jobs_route(client, tmp_path):
    target = tmp_path / "x"
    target.write_bytes(b"abc")
    started = client.post("/api/hash", json={"paths": [str(target)], "algorithms": ["md5"]}).json()
    done = finish(client, started)
    assert done["kind"] == "hash" and done["title"] == "Hash 1 file"
    assert done["result"]["items"][0]["hashes"]["md5"] == ABC["md5"]
